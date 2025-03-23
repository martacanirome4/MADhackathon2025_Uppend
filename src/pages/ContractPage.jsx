import React, { useState, useEffect } from 'react'
import QubicConnector from './QubicConnector';
import { QubicProcedureInputBuilder } from "@qubic-lib/qubic-ts-library"
import { QubicHelper } from 'qubic-ts-library/dist/qubicHelper'

function encodeInitAgreementPayload({ contractName, counterparty, validator, startDateEpoch, frequencyDays, deliveryDateEpoch }) {
    const builder = new QubicProcedureInputBuilder();
    builder.addString(contractName, 64);
    builder.addPublicKey(counterparty);
    builder.addPublicKey(validator);
    builder.addUint64(startDateEpoch);
    builder.addUint32(frequencyDays);
    builder.addUint64(deliveryDateEpoch);
    return builder.getBytes();
}

function ContractPage() {
    const [connector, setConnector] = useState(null)
    const [tick, setTick] = useState(0)
    const [status, setStatus] = useState('')
    const [contractName, setContractName] = useState('')
    const [counterparty, setCounterparty] = useState('')
    const [validator, setValidator] = useState('')
    const [amount, setAmount] = useState('0')
    const [frequency, setFrequency] = useState('monthly')
    const [frequencyDays, setFrequencyDays] = useState(30)
    const [deliveryDate, setDeliveryDate] = useState('')
    const [penaltyInfo, setPenaltyInfo] = useState('')
    const [nextPaymentDate, setNextPaymentDate] = useState('')

    // Conectar al nodo al montar
    useEffect(() => {
        console.log('[INIT] Inicializando QubicConnector...')
        const qc = new QubicConnector()

        qc.onReady = () => {
            console.log('[READY] QubicConnector listo')
        }

        qc.onPeerConnected = () => {
            console.log('[CONNECTED] Conectado al nodo Qubic correctamente')
            setStatus('Nodo conectado')
        }

        qc.onTick = (t) => {
            setTick(t)
            console.log('[TICK] Tick actualizado:', t)
        }

        qc.onSocketError = (err) => {
            console.error('[ERROR] Socket error:', err)
            setStatus('Error de conexión al nodo')
        }

        qc.connect('195.26.231.116') // ⚠️ nodo remoto
        qc.start()
        setConnector(qc)

        return () => {
            qc.stop()
            qc.destroy()
            console.log('[CLEANUP] Desconectado del nodo Qubic')
        }
    }, [])

    // Frecuencia y fecha de pago
    useEffect(() => {
        const now = new Date()
        let daysToAdd = 30
        if (frequency === 'weekly') daysToAdd = 7
        else if (frequency === 'custom') daysToAdd = 15

        setFrequencyDays(daysToAdd)
        const nextDate = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000)
        setNextPaymentDate(nextDate.toDateString())
    }, [frequency])

    useEffect(() => {
        if (deliveryDate) {
            setPenaltyInfo(`If delivery occurs after ${deliveryDate}, a 10% penalty applies.`)
        } else {
            setPenaltyInfo('')
        }
    }, [deliveryDate])

    const handleDeposit = async () => {
        console.log('[DEPOSIT] Iniciando proceso de depósito...')
        if (!connector || !connector.peerConnected) {
            console.error('[ERROR] No conectado al nodo')
            setStatus('❌ No conectado al nodo.')
            return
        }

        try {
            setStatus('Procesando...')

            const contractId = 'WEVWZOHASCHODGRVRFKZCGUDGHEDWCAZIZXWBUHZEAMNVHKZPOIZKUEHNQSJ' // Actualiza si es necesario
            const procedureIndex = 3
            const reward = BigInt(amount)

            const startDateEpoch = Math.floor(Date.now() / 1000)
            const deliveryDateEpoch = Math.floor(new Date(deliveryDate).getTime() / 1000)

            // Validación básica
            if (!contractName || !counterparty || !validator || isNaN(reward) || reward <= 0) {
                console.warn('[VALIDATION] Datos inválidos:', { contractName, counterparty, validator, reward })
                setStatus('❌ Datos inválidos. Revisa los campos.')
                return
            }

            console.log('[INPUT] Datos del contrato:', {
                contractName, counterparty, validator,
                startDateEpoch, frequencyDays, deliveryDateEpoch, reward
            })

            const payloadBytes = encodeInitAgreementPayload({
                contractName,
                counterparty,
                validator,
                startDateEpoch,
                frequencyDays,
                deliveryDateEpoch
            })

            console.log('[PAYLOAD] Bytes generados:', payloadBytes)

            // Aquí se debería enviar la transacción usando un método adecuado
            // Ejemplo: connector.sendPackage(transaccion)

            setStatus(`✅ Payload listo. Tick actual: ${tick}`)
        } catch (error) {
            console.error('[ERROR] Fallo durante depósito:', error)
            setStatus('❌ Error durante depósito. Revisa consola.')
        }
    }

    return (
        <div className="p-6 text-white mt-24">
            <h2 className="text-2xl mb-4">Create Supply Contract - Deposit</h2>
            <p className="text-sm text-gray-300 mb-2">Estado: {status}</p>
            <p className="text-sm text-gray-300 mb-4">Tick Conectado: <span className="text-green-400">{tick}</span></p>

            <div className="space-y-2">
                <input type="text" placeholder="Contract Name" value={contractName} onChange={(e) => setContractName(e.target.value)} className="p-2 w-full rounded bg-gray-800 text-white border" />
                <input type="text" placeholder="Counterparty Address" value={counterparty} onChange={(e) => setCounterparty(e.target.value)} className="p-2 w-full rounded bg-gray-800 text-white border" />
                <input type="text" placeholder="Validator Address" value={validator} onChange={(e) => setValidator(e.target.value)} className="p-2 w-full rounded bg-gray-800 text-white border" />
                <input type="number" placeholder="Amount to Deposit" value={amount} onChange={(e) => setAmount(e.target.value)} className="p-2 w-full rounded bg-gray-800 text-white border" />
                <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="p-2 w-full rounded bg-gray-800 text-white border">
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                    <option value="custom">Every 15 days</option>
                </select>
                <p className="text-sm text-gray-300">Next payment: <span className="text-green-400">{nextPaymentDate}</span></p>
                <label className="text-sm text-gray-300">Committed Delivery Date:</label>
                <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="p-2 w-full rounded bg-gray-800 text-white border" />
                {penaltyInfo && <p className="text-sm text-yellow-400 mt-1">{penaltyInfo}</p>}
                <button onClick={handleDeposit} className="bg-blue-500 text-white p-2 rounded w-full mt-2">Deposit and Create Contract</button>
            </div>
        </div>
    )
}

export default ContractPage
