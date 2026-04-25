import React, { ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
         return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-gray-800 p-6">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-red-100">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle size={32} />
            </div>
            <h2 className="text-2xl font-bold mb-4">Une erreur est survenue</h2>
            <p className="text-gray-600 mb-6 font-medium">
              Nous n'avons pas pu charger l'expérience 360°.
            </p>
            {this.state.error && (
               <div className="bg-gray-100 rounded-lg p-4 mb-6 text-left overflow-x-auto">
                 <p className="text-xs font-mono text-gray-700 whitespace-pre-wrap breakdown-all">
                   {this.state.error.message}
                 </p>
               </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="flex items-center justify-center w-full gap-2 px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 hover:shadow-lg transition-all"
            >
              <RefreshCw size={20} />
              Recharger la page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
