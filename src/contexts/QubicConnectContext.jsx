// src/contexts/QubicConnectContext.jsx
/* global BigInt */

import React, {createContext, useContext, useEffect, useState} from "react"
import {useConfig} from "./ConfigContext"
import {MetaMaskProvider, defaultSnapOrigin} from "./MetamaskContext"
import {WalletConnectProvider, useWalletConnectContext} from "./WalletConnectContext"

import {QubicHelper} from "@qubic-lib/qubic-ts-library/dist/qubicHelper"
import Crypto, {SIGNATURE_LENGTH} from "@qubic-lib/qubic-ts-library/dist/crypto"
import {QubicTransaction} from "@qubic-lib/qubic-ts-library/dist/qubic-types/QubicTransaction"
import {base64ToUint8Array, decodeUint8ArrayTx} from "../components/qubic/util/index"
import { toast } from "react-hot-toast"

async function localSignTx(qHelper, privateKey, tx) {
    const qCrypto = await Crypto
    const idPackage = await qHelper.createIdPackage(privateKey)

    const digest = new Uint8Array(qHelper.DIGEST_LENGTH)
    const toSign = tx.slice(0, tx.length - SIGNATURE_LENGTH)

    qCrypto.K12(toSign, digest, qHelper.DIGEST_LENGTH)

    const signature = qCrypto.schnorrq.sign(
        idPackage.privateKey,
        idPackage.publicKey,
        digest
    )

    tx.set(signature, tx.length - SIGNATURE_LENGTH)
    return tx
}

const QubicConnectContext = createContext(null)

export function QubicConnectProvider({ children }) {
    const [connected, setConnected] = useState(false)
    const [wallet, setWallet] = useState(null)
    const [showConnectModal, setShowConnectModal] = useState(false)

    const {httpEndpoint} = useConfig()
    const wcCtx = useWalletConnectContext()

    const qHelper = new QubicHelper()

    useEffect(() => {
        const saved = localStorage.getItem("wallet")
        if (!saved) return

        try {
            const parsed = JSON.parse(saved)
            setWallet(parsed)
            setConnected(true)
        } catch (error) {
            connect({
                connectType: "privateKey",
                privateKey: saved
            })
        }
    }, [])

    function uint8ArrayToBase64(uint8Array) {
        const binaryString = String.fromCharCode.apply(null, uint8Array)
        return btoa(binaryString)
    }

    const broadcastTx = async (tx) => {
        if (!httpEndpoint) {
            throw new Error('No httpEndpoint is set')
        }
        const url = `${httpEndpoint}/v1/broadcast-transaction`
        const txEncoded = uint8ArrayToBase64(tx)
        const body = {encodedTransaction: txEncoded}
        try {
            const response = await fetch(url, {
                method: 'POST',
                body: JSON.stringify(body),
            })
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
            return await response.json()
        } catch (error) {
            console.error('Error:', error)
        }
    }

    const getTick = async () => {
        const tickResult = await fetch(`${httpEndpoint}/v1/tick-info`)
        const tick = await tickResult.json()
        if (!tick || !tick.tickInfo || !tick.tickInfo.tick) {
            console.warn('getTick: Invalid tick')
            return 0
        }
        return tick.tickInfo.tick
    }

    const connect = (walletInfo) => {
        localStorage.setItem("wallet", JSON.stringify(walletInfo))
        setWallet(walletInfo)
        setConnected(true)
    }

    const disconnect = () => {
        localStorage.removeItem("wallet")
        setWallet(null)
        setConnected(false)
        wcCtx.disconnect() // also end WalletConnect session
    }

    const toggleConnectModal = () => {
        setShowConnectModal(!showConnectModal)
    }

    const signTransaction = async (tx) => {
        if (!wallet || !wallet.connectType) {
            throw new Error("No wallet or connectType set.")
        }

        let processedTx
        if (tx instanceof QubicTransaction) {
            processedTx = await tx.build(wallet.privateKey ?? "0".repeat(55))
        } else {
            processedTx = tx
        }

        switch (wallet.connectType) {
            case "privateKey":
            case "vaultFile": {
                return await localSignTx(qHelper, wallet.privateKey, processedTx)
            }

            case "mmSnap": {
                const base64Tx = btoa(String.fromCharCode(...processedTx))
                const offset = processedTx.length - SIGNATURE_LENGTH

                const signedResult = await window.ethereum.request({
                    method: "wallet_invokeSnap",
                    params: {
                        snapId: defaultSnapOrigin,
                        request: {
                            method: "signTransaction",
                            params: {
                                base64Tx,
                                accountIdx: 0,
                                offset,
                            },
                        },
                    },
                })
                const binary = atob(signedResult.signedTx)
                const signature = new Uint8Array(binary.length)
                for (let i = 0; i < binary.length; i++) {
                    signature[i] = binary.charCodeAt(i)
                }
                processedTx.set(signature, offset)
                return processedTx
            }
            case "walletconnect": {
                toast(("toast.Sign the transaction in your wallet"), {
                    icon: "🔑",
                })
                const decodedTx = decodeUint8ArrayTx(processedTx)

                const [from, to] = await Promise.all([
                    qHelper.getIdentity(decodedTx.sourcePublicKey.getIdentity()),
                    qHelper.getIdentity(decodedTx.destinationPublicKey.getIdentity())
                ])

                
                const payloadBase64 = decodedTx.payload
                    ? uint8ArrayToBase64(decodedTx.payload.getPackageData())
                    : null

                // Request signature from Qubic Wallet via WC
                const wcResult = await wcCtx.signTransaction({
                    from,
                    to,
                    amount: Number(decodedTx.amount.getNumber()),
                    tick: decodedTx.tick,
                    inputType: decodedTx.inputType,
                    payload: payloadBase64 === "" ? null : payloadBase64
                })

                return base64ToUint8Array(wcResult.signedTransaction)
            }
            default:
                throw new Error(`Unsupported connectType: ${wallet.connectType}`)
        }
    }

    const invokeContractProcedure = async (contractId, procedureIndex, inputObject, rewardAmount) => {
        try {
            const tick = await getTick(); // 🕒 Necesario para transacción válida
            const payload = qHelper.encodeProcedurePayload(procedureIndex, inputObject); // Codifica input
    
            const tx = await qHelper.createTransaction({
                sourcePrivateKey: wallet.privateKey,
                destinationContractId: contractId,
                payload,
                reward: BigInt(rewardAmount),  // ⚠️ Asegúrate que sea BigInt
                tick,
            });
    
            // Firmar con método ya incluido
            const signedTx = await signTransaction(tx);
    
            // Broadcast usando función que ya tienes
            const result = await broadcastTx(signedTx);
    
            if (!result || !result.transactionHash) {
                throw new Error('Broadcast failed');
            }
    
            return result.transactionHash; // Retorna hash usable
        } catch (error) {
            console.error('invokeContractProcedure error:', error);
            throw error;
        }
    };
    

    return (
        <QubicConnectContext.Provider
            value={{
                connected,
                wallet,
                showConnectModal,
                connect, 
                disconnect,
                toggleConnectModal,
                signTransaction,
                getTick,
                broadcastTx,
                invokeContractProcedure // 👈 Añadimos la función a nuestro contexto
            }}
        >
            {children}
        </QubicConnectContext.Provider>
    )
}

export function QubicConnectCombinedProvider({ children }) {
    return (
        <MetaMaskProvider>
            <WalletConnectProvider>
                <QubicConnectProvider>{children}</QubicConnectProvider>
            </WalletConnectProvider>
        </MetaMaskProvider>
    )
}

export function useQubicConnect() {
    const ctx = useContext(QubicConnectContext)
    if (!ctx) {
        throw new Error("useQubicConnect must be used within QubicConnectProvider")
    }
    return ctx
}
