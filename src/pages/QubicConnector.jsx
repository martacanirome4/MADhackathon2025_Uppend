import { QubicPackageType } from "@qubic-lib/qubic-ts-library/dist/qubic-communication/QubicPackageType";
import { ReceivedPackage } from "@qubic-lib/qubic-ts-library/dist/qubic-communication/ReceivedPackage";
import { RequestResponseHeader } from "@qubic-lib/qubic-ts-library/dist/qubic-communication/RequestResponseHeader";
import { QubicTickInfo } from "@qubic-lib/qubic-ts-library/dist/qubic-types/QubicTickInfo";
import { QubicEntityResponse } from "@qubic-lib/qubic-ts-library/dist/qubic-communication/QubicEntityResponse";
import { PublicKey } from "@qubic-lib/qubic-ts-library/dist/qubic-types/PublicKey";
import { QubicPackageBuilder } from "@qubic-lib/qubic-ts-library/dist/QubicPackageBuilder";
import { QubicEntityRequest } from "@qubic-lib/qubic-ts-library/dist/qubic-communication/QubicEntityRequest";
import { KeyHelper } from "@qubic-lib/qubic-ts-library/dist/keyHelper";
import crypto from "@qubic-lib/qubic-ts-library/dist/crypto";
import net from "net";


class QubicConnector {
    constructor() {
        this.PORT = 31841;
        this.socket = new net.Socket();
        this.peerConnected = false;
        this.connectedPeerAddress = undefined;
        this.buffer = new Uint8Array(4 * 1024 * 1024);
        this.bufferWritePosition = 0;
        this.bufferReadPosition = 0;
        this.currentTick = 0;
        this.timer = null;

        // Event handlers (can be overridden)
        this.onReady = null;
        this.onPeerConnected = null;
        this.onPeerDisconnected = null;
        this.onBalance = null;
        this.onTick = null;
        this.onPackageReceived = null;
        this.onSocketError = null;

        if (this.socket) {
            this.socket.on('data', (d) => this.writeBuffer(d));
            this.socket.on('close', () => {
                if (this.onPeerDisconnected) this.onPeerDisconnected();
            });
            this.socket.on('error', (er) => {
                if (this.onSocketError) this.onSocketError(er);
            });
        }
    }

    onPeerConnect() {
        this.peerConnected = true;
        if (this.onPeerConnected) this.onPeerConnected();
    }

    toBase64(u8) {
        return btoa(String.fromCharCode.apply(null, u8));
    }

    connectPeer(ipAddress) {
        try {
            this.socket.connect(this.PORT, ipAddress, () => this.onPeerConnect());
            this.connectedPeerAddress = ipAddress;
            return true;
        } catch (e) {
            console.error("ERROR in Socket Connection", e);
            return false;
        }
    }

    disconnectPeer() {
        if (this.connectedPeerAddress) {
            this.socket.destroy();
            this.connectedPeerAddress = undefined;
            this.peerConnected = false;
        }
    }

    reconnectPeer() {
        this.disconnectPeer();
        if (this.connectedPeerAddress) {
            return this.connectPeer(this.connectedPeerAddress);
        }
        return false;
    }

    writeBuffer(data) {
        let writeLength = data.length;
        if (this.bufferWritePosition + data.length > this.buffer.length) {
            writeLength = this.buffer.length - this.bufferWritePosition;
        }

        this.buffer.set(data.slice(0, writeLength), this.bufferWritePosition);
        this.bufferWritePosition += writeLength;

        if (writeLength < data.length) {
            this.bufferWritePosition = 0;
            this.buffer.set(data.slice(writeLength, data.length));
            this.bufferWritePosition += data.length - writeLength;
        }

        this.processBuffer();
    }

    readFromBuffer(numberOfBytes, setReadPosition = false) {
        const extract = new Uint8Array(numberOfBytes);
        if (this.bufferReadPosition + numberOfBytes <= this.buffer.length) {
            extract.set(this.buffer.slice(this.bufferReadPosition, this.bufferReadPosition + numberOfBytes));
        } else {
            extract.set(this.buffer.slice(this.bufferReadPosition));
            extract.set(this.buffer.slice(0, this.bufferReadPosition + numberOfBytes - this.buffer.length));
        }
        if (setReadPosition) this.setReadPosition(numberOfBytes);
        return extract;
    }

    setReadPosition(numberOfReadBytes) {
        if (this.bufferReadPosition + numberOfReadBytes > this.buffer.length) {
            this.bufferReadPosition = (this.bufferReadPosition + numberOfReadBytes - this.buffer.length);
        } else {
            this.bufferReadPosition += numberOfReadBytes;
        }
    }

    processBuffer() {
        while (true) {
            const toReadBytes = Math.abs(this.bufferWritePosition - this.bufferReadPosition);
            if (toReadBytes < 8) break;

            const header = new RequestResponseHeader();
            header.parse(this.readFromBuffer(8));
            if (!header || toReadBytes < header.getSize()) break;

            this.setReadPosition(header.getPackageSize());
            const recPackage = new ReceivedPackage();
            recPackage.header = header;
            recPackage.ipAddress = this.connectedPeerAddress || "";
            if (header.getSize() > 8) {
                recPackage.payLoad = this.readFromBuffer(header.getSize() - header.getPackageSize(), true);
            } else {
                recPackage.payLoad = new Uint8Array(0);
            }

            this.processPackage(recPackage);
            if (this.onPackageReceived) this.onPackageReceived(recPackage);
        }
    }

    processPackage(p) {
        if (p.header.getType() === QubicPackageType.RESPOND_CURRENT_TICK_INFO) {
            const tickInfo = new QubicTickInfo().parse(p.payLoad);
            if (tickInfo && this.currentTick < tickInfo.getTick()) {
                this.currentTick = tickInfo.getTick();
                if (this.onTick) this.onTick(this.currentTick);
            }
        } else if (p.header.getType() === QubicPackageType.RESPOND_ENTITY && this.onBalance) {
            const entityResponse = new QubicEntityResponse().parse(p.payLoad);
            this.onBalance(entityResponse);
        }
    }

    requestTickInfo() {
        if (this.peerConnected) {
            const header = new RequestResponseHeader(QubicPackageType.REQUEST_CURRENT_TICK_INFO);
            header.randomizeDejaVu();
            this.sendPackage(header.getPackageData());
        }
    }

    requestBalance(pkey) {
        if (!this.peerConnected) return;
        const header = new RequestResponseHeader(QubicPackageType.REQUEST_ENTITY, pkey.getPackageSize());
        header.randomizeDejaVu();
        const builder = new QubicPackageBuilder(header.getSize());
        builder.add(header);
        builder.add(new QubicEntityRequest(pkey));
        const data = builder.getData();
        this.sendPackage(data);
    }

    GetPrivatePublicKey(seed) {
        return crypto.then(({ schnorrq, K12 }) => {
            const keyHelper = new KeyHelper();
            const privateKey = keyHelper.privateKey(seed, 0, K12);
            const publicKey = keyHelper.createPublicKey(privateKey, schnorrq, K12);
            return { privateKey, publicKey };
        });
    }

    initialize() {
        this.bufferReadPosition = 0;
        this.bufferWritePosition = 0;
        this.timer = setInterval(() => this.requestTickInfo(), 500);
        if (this.onReady) this.onReady();
    }

    connect(ip) {
        this.connectPeer(ip);
    }

    sendPackage(data) {
        return this.sendTcpPackage(data);
    }

    sendTcpPackage(data) {
        if (!this.peerConnected) return false;
        this.socket.write(data);
        return true;
    }

    start() {
        this.initialize();
    }

    stop() {
        clearInterval(this.timer);
        this.disconnectPeer();
    }

    destroy() {
        this.stop();
        if (this.socket) this.socket.destroy();
    }
}

export default QubicConnector;
