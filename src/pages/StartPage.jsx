// src/pages/StartPage.jsx
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useQubicConnect } from '../contexts/QubicConnectContext'
import { useHM25 } from '../contexts/HM25Context'
import { QubicHelper } from 'qubic-ts-library/dist/qubicHelper'

function StartPage() {
    const navigate = useNavigate()
    const { connected, toggleConnectModal } = useQubicConnect()
    const { state, balance } = useHM25()

    if (!connected) {
        return (
            <div className="mt-20 flex flex-col items-center">
                <h2 className="text-2xl text-white mb-20 mt-20">Welcome to HM25 - Hackathon Madrid 2025 Demo DApp</h2>
                <p className="text-gray-300 mb-4 mt-4 ml-6 mr-4">
                    You are not connected to a wallet. Please connect to proceed.
                </p>
                <button
                    className="bg-primary-40 p-3 text-black rounded"
                    onClick={toggleConnectModal}
                >
                    Connect Wallet
                </button>
            </div>
        )
    }

    const isDisabled = balance === null || balance <= 0

    return (
        <div className="mt-20 px-10 flex flex-col items-center">
            <h2 className="text-2xl text-white mb-6 mt-6">HM25 Actions</h2>
            <div className="flex gap-4">
                <button
                    className="bg-primary-40 p-3 text-black rounded disabled:bg-gray-400 disabled:cursor-not-allowed"
                    onClick={() => navigate('/echo')}
                    disabled={isDisabled}
                    title={isDisabled ? 'Insufficient balance to echo coins.' : ''}
                >
                    Echo Coin
                </button>
                <button
                    className="bg-primary-40 p-3 text-black rounded disabled:bg-gray-400 disabled:cursor-not-allowed"
                    onClick={() => navigate('/burn')}
                    disabled={isDisabled}
                    title={isDisabled ? 'Insufficient balance to burn coins.' : ''}
                >
                    Burn Coin
                </button>
                {/* Añadir botón para ir a la página de contrato */}
                <button
                    className="bg-primary-40 p-3 text-black rounded"
                    onClick={() => navigate('/contract')}
                >
                    Create Contract
                </button>
            </div>
            <div className="mt-8 p-4 bg-gray-800 rounded-lg border border-gray-700 text-white">
                <p><strong>Number of Echos:</strong> {state.stats.numberOfEchoCalls.toString()}</p>
                <p><strong>Number of Burns:</strong> {state.stats.numberOfBurnCalls.toString()}</p>
            </div>
        </div>
    )
}

export default StartPage
