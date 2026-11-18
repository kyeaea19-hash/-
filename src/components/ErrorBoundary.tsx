import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || '알 수 없는 오류가 발생했습니다.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-surface flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-surface-container-lowest rounded-xl p-6 shadow-md text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-error-container text-error flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[26px]">bolt</span>
            </div>
            <h2 className="font-headline-md text-headline-md text-on-surface">
              전력망 연결에 일시적인 오류가 발생했어요
            </h2>
            <p className="font-body-sm text-body-sm text-secondary break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full h-11 rounded-xl bg-primary-container text-on-primary font-label-lg text-label-lg font-bold shadow-sm"
            >
              발전소 다시 연결하기
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
