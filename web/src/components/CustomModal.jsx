import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, HelpCircle, Info, X } from 'lucide-react';

const CustomModal = ({ config, onClose }) => {
  const { type, title, message, defaultValue = '' } = config;
  const [inputValue, setInputValue] = useState(defaultValue);
  const inputRef = useRef(null);

  // Auto-focus and select text for prompt inputs
  useEffect(() => {
    if (type === 'prompt' && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [type]);

  // Handle keyboard events (Enter/Escape)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (type === 'alert') {
          onClose(undefined);
        } else {
          onClose(type === 'prompt' ? null : false);
        }
      } else if (e.key === 'Enter') {
        // Prevent enter key submitting if it's prompt and empty (if validation is needed),
        // but generally standard behavior is to submit
        if (type === 'prompt') {
          onClose(inputValue);
        } else {
          onClose(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [type, inputValue, onClose]);

  const handleConfirm = () => {
    if (type === 'prompt') {
      onClose(inputValue);
    } else {
      onClose(true);
    }
  };

  const handleCancel = () => {
    if (type === 'prompt') {
      onClose(null);
    } else {
      onClose(false);
    }
  };

  // Get icon and color scheme based on type/content
  const getHeaderIcon = () => {
    switch (type) {
      case 'confirm':
        return <HelpCircle className="w-6 h-6 text-capsab-orange animate-bounce-subtle" />;
      case 'prompt':
        return <Info className="w-6 h-6 text-sky-500" />;
      case 'alert':
      default:
        return <AlertCircle className="w-6 h-6 text-red-500" />;
    }
  };

  // Split lines on newline to render multiple paragraphs or line breaks nicely
  const messageParagraphs = message ? message.split('\n') : [];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all duration-300">
      {/* Modal Card */}
      <div 
        className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col p-6 animate-scale-up"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3 mb-4 select-none">
          <div className="p-2 bg-slate-50 rounded-xl">
            {getHeaderIcon()}
          </div>
          <h3 className="text-sm font-extrabold text-slate-800 flex-1 leading-none tracking-wide">
            {title || (type === 'confirm' ? 'Confirmación' : type === 'prompt' ? 'Entrada requerida' : 'Aviso')}
          </h3>
          <button
            type="button"
            onClick={handleCancel}
            className="text-slate-400 hover:text-slate-600 transition p-1.5 rounded-full hover:bg-slate-50 cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Body */}
        <div className="flex-1 text-slate-600 text-xs font-semibold space-y-2.5 mb-6 select-text">
          {messageParagraphs.map((para, idx) => (
            <p key={idx} className="leading-relaxed">
              {para}
            </p>
          ))}
        </div>

        {/* Prompt Input */}
        {type === 'prompt' && (
          <div className="mb-6">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:border-capsab-green text-xs font-bold bg-slate-50 focus:bg-white transition duration-150 shadow-sm"
              placeholder="Escriba aquí..."
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 mt-2 select-none">
          {(type === 'confirm' || type === 'prompt') && (
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 py-3 px-4 border border-slate-200 text-slate-500 hover:text-slate-700 bg-white hover:bg-slate-50 active:bg-slate-100 font-bold text-xs rounded-xl shadow-sm transition duration-150 cursor-pointer"
            >
              Cancelar
            </button>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            className={`flex-1 py-3 px-4 text-white font-bold text-xs rounded-xl shadow-md transition duration-150 cursor-pointer ${
              type === 'alert'
                ? 'bg-red-500 hover:bg-red-600 active:bg-red-700'
                : type === 'confirm'
                ? 'bg-capsab-orange hover:bg-capsab-orange-hover active:bg-capsab-orange-dark'
                : 'bg-capsab-green hover:bg-capsab-green-hover active:bg-capsab-green-dark'
            }`}
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomModal;
