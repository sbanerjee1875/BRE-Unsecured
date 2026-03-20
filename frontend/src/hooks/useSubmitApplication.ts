import { useState } from 'react';
import type { FormState } from '../types/form';
import type { UnderwritingResponse } from '../types/api';
import { generatePayload } from '../utils/generatePayload';

interface SubmitState {
  loading: boolean;
  result: UnderwritingResponse | null;
  error: string | null;
}

export function useSubmitApplication() {
  const [state, setState] = useState<SubmitState>({ loading: false, result: null, error: null });

  const submit = async (form: FormState) => {
    setState({ loading: true, result: null, error: null });
    try {
      const payload = await generatePayload(form);
      const res = await fetch('/v1/demo/underwrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.message || errBody?.details?.[0]?.message || `Server error: ${res.status}`);
      }

      const result = await res.json();
      setState({ loading: false, result, error: null });
    } catch (err: any) {
      setState({ loading: false, result: null, error: err.message || 'Something went wrong' });
    }
  };

  const reset = () => setState({ loading: false, result: null, error: null });

  return { ...state, submit, reset };
}
