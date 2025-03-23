import React, { useState, useEffect } from 'react';
import { QubicTransaction } from '@qubic-lib/qubic-ts-library/dist/qubic-types/QubicTransaction';
import { PublicKey } from '@qubic-lib/qubic-ts-library/dist/qubic-types/PublicKey';
import { Long } from '@qubic-lib/qubic-ts-library/dist/qubic-types/Long';
import { useQubicConnect } from '../contexts/QubicConnectContext';

const CONTRACT_ID = 'WEVWZOHASCHODGRVRFKZCGUDGHEDWCAZIZXWBUHZEAMNVHKZPOIZKUEHNQSJ';
const PROCEDURE_INDEX = 3;

function ContractPage() {
    const { connected, invokeContractProcedure, getTick, wallet } = useQubicConnect();

    const [counterparty, setCounterparty] = useState('');
    const [contractName, setContractName] = useState('');
    const [amount, setAmount] = useState('0');
    const [frequency, setFrequency] = useState('monthly');
    const [frequencyDays, setFrequencyDays] = useState(30);
    const [nextPaymentDate, setNextPaymentDate] = useState('');
    const [deliveryDate, setDeliveryDate] = useState('');
    const [penaltyInfo, setPenaltyInfo] = useState('');
    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(false);

    // Calculate next payment date based on frequency
    useEffect(() => {
        const now = new Date();
        let daysToAdd = frequency === 'weekly' ? 7 : frequency === 'custom' ? 15 : 30;
        setFrequencyDays(daysToAdd);
        const nextDate = new Date(now.getTime() + daysToAdd * 86400000);
        setNextPaymentDate(nextDate.toDateString());
      }, [frequency]);
    
      useEffect(() => {
        if (deliveryDate) {
          setPenaltyInfo(`If delivery occurs after ${deliveryDate}, a 10% penalty will be applied.`);
        } else {
          setPenaltyInfo('');
        }
      }, [deliveryDate]);

    const buildPayload = (contractName, counterpartyId, startDateEpoch, frequencyDays, deliveryDateEpoch) => {
        const encoder = new TextEncoder();
        const contractBytes = encoder.encode(contractName.padEnd(64, '\0')).slice(0, 64);
        const counterpartyKey = new PublicKey(counterpartyId);
        const startDateBytes = new BigUint64Array([BigInt(startDateEpoch)]);
        const frequencyBytes = new Uint32Array([frequencyDays]);
        const deliveryDateBytes = new BigUint64Array([BigInt(deliveryDateEpoch)]);
    
        const payloadSize = 64 + counterpartyKey.getPackageSize() + 8 + 4 + 8;
        const payload = new Uint8Array(payloadSize);
        let offset = 0;
    
        payload.set(contractBytes, offset); offset += 64;
        payload.set(counterpartyKey.getPackageData(), offset); offset += counterpartyKey.getPackageSize();
        payload.set(new Uint8Array(startDateBytes.buffer), offset); offset += 8;
        payload.set(new Uint8Array(frequencyBytes.buffer), offset); offset += 4;
        payload.set(new Uint8Array(deliveryDateBytes.buffer), offset);
    
        return payload;
    };
    
    const handleDeposit = async () => {
        try {
            setLoading(true);
            const reward = BigInt(amount);
            const startDateEpoch = Math.floor(Date.now() / 1000);
            const deliveryDateEpoch = Math.floor(new Date(deliveryDate).getTime() / 1000);
      
            const payloadBytes = buildPayload(contractName, counterparty, startDateEpoch, frequencyDays, deliveryDateEpoch);
            console.log('[Deposit] Payload Bytes:', payloadBytes);
      
            const tick = await getTick();
            const tx = new QubicTransaction()
              .setSourcePublicKey(new PublicKey(wallet.publicKey))
              .setDestinationPublicKey(new PublicKey(CONTRACT_ID))
              .setAmount(new Long(reward))
              .setTick(tick + 5)
              .setInputType(PROCEDURE_INDEX)
              .setInputSize(payloadBytes.length)
              .setPayload(payloadBytes);
      
            await tx.build(wallet.privateKey);
            const rawTx = tx.getPackageData();
            const encodedTx = btoa(String.fromCharCode(...rawTx));
      
            const res = await fetch('https://testnet-rpc.qubic.org/v1/broadcast-transaction', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ encodedTransaction: encodedTx }),
            });
      
            const result = await res.json();
            if (!res.ok) throw new Error(result.message || 'Broadcast failed');
      
            setStatus(`✅ Success! TX Hash: ${result.transactionHash}`);
          } catch (err) {
            console.error('[Deposit] Error:', err);
            setStatus(`❌ Error: ${err.message}`);
          } finally {
            setLoading(false);
          }
    };
    

    if (!connected) {
        return <div className="p-6 text-white">🔗 Connect your wallet to create a contract.</div>;
    }
    

    return (
        <div className="p-6 text-white" style={{ marginTop: '100px' }}>
        <h2 className="text-2xl mb-4">Create Supply Contract - Deposit</h2>
        <div className="space-y-2">
            <input
            type="text"
            placeholder="Contract Name"
            value={contractName}
            onChange={(e) => setContractName(e.target.value)}
            className="p-2 w-full rounded bg-gray-800 text-white border"
            />
            <input
            type="text"
            placeholder="Counterparty Qubic ID"
            value={counterparty}
            onChange={(e) => setCounterparty(e.target.value)}
            className="p-2 w-full rounded bg-gray-800 text-white border"
            />
            <input
            type="number"
            placeholder="Amount to Deposit"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="p-2 w-full rounded bg-gray-800 text-white border"
            />
            <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            className="p-2 w-full rounded bg-gray-800 text-white border"
            >
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
            <option value="custom">Every 15 days</option>
            </select>

            <p className="text-sm text-gray-300">
            Next payment: <span className="text-green-400">{nextPaymentDate}</span>
            </p>

            <label className="text-sm text-gray-300">Delivery Due Date:</label>
            <input
            type="date"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
            className="p-2 w-full rounded bg-gray-800 text-white border"
            />

            {penaltyInfo && <p className="text-sm text-yellow-400 mt-1">{penaltyInfo}</p>}

            <button
            onClick={handleDeposit}
            className="bg-blue-500 text-white p-2 rounded w-full mt-2"
            >
            Deposit and Create Contract
            </button>
        </div>
        {status && <p className="mt-4 text-green-400">{status}</p>}
        </div>
    );
    }

export default ContractPage;
