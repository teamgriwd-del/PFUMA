import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[PFUMA] Component error:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 bg-gray-50 text-center">
        <div className="bg-white p-12 rounded-[50px] shadow-xl border border-red-100 max-w-md w-full">
          <div className="w-20 h-20 bg-red-50 rounded-[30px] flex items-center justify-center mx-auto mb-6">
            <AlertTriangle size={40} className="text-red-500" />
          </div>
          <h3 className="text-2xl font-black text-gray-800 mb-2">Module Error</h3>
          <p className="text-sm text-gray-400 font-bold leading-relaxed mb-8">
            This section encountered an unexpected error. Your data is safe.
          </p>
          {this.state.error && (
            <pre className="text-left text-[10px] font-mono bg-gray-50 p-4 rounded-2xl text-red-600 mb-8 overflow-auto max-h-32">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="flex items-center justify-center space-x-2 w-full py-4 bg-pfuma-green text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-105 transition shadow-lg shadow-green-900/20"
          >
            <RefreshCw size={16} />
            <span>Retry Module</span>
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
