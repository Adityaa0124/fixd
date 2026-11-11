import { Component, type ReactNode } from 'react';

/** Keeps one broken case from blanking the whole console. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="m-6 rounded-card border border-bad-600/30 bg-bad-50 p-5 text-sm text-bad-600">
        <p className="font-medium">This case could not be displayed.</p>
        <p className="mt-1 text-tx-2">Move to another case with J or K. Details: {this.state.error.message}</p>
      </div>
    );
  }
}
