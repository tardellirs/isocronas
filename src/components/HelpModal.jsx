import React from 'react';

const HelpModal = ({ onClose }) => (
    <div className="fixed inset-0 z-[9999] modal-overlay flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-gray-800">Como obter dados reais?</h2>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-4 text-sm text-gray-600">
                <p>Para o mapa contornar as ruas perfeitamente, usamos o <strong>OpenRouteService</strong>. Ele é excelente para carros e bicicletas.</p>
                <ol className="list-decimal pl-5 space-y-2">
                    <li>Acesse <a href="https://openrouteservice.org/dev/#/signup" target="_blank" rel="noreferrer" className="text-indigo-600 font-bold underline">openrouteservice.org</a> e crie uma conta.</li>
                    <li>Gere um "Token" (Free).</li>
                    <li>Copie e cole a chave no campo de configurações abaixo.</li>
                </ol>
            </div>
            <button onClick={onClose} className="mt-6 w-full py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700">Entendi</button>
        </div>
    </div>
);

export default HelpModal;
