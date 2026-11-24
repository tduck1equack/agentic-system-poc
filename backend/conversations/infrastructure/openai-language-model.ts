import OpenAI from 'openai';
import { toResponseInputItems } from 'openai/lib/responses/ResponseInputItems';
import type { ResponseInput, FunctionTool } from 'openai/resources/responses/responses';
import { LanguageModel, ModelSession } from '../application/ports';
import { ToolDefinition } from '../../shared/application/ports';
import { DomainError } from '../../shared/domain/errors';
export class OpenAiLanguageModel implements LanguageModel {
  async verify(signal: AbortSignal) {
    const model = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';
    if (!process.env.OPENAI_API_KEY?.trim()) throw new DomainError('invalid', 'Model API key is not configured');
    const api = new OpenAI();
    await api.responses.create({
      model,
      instructions: 'Verify provider connectivity. Available installations: []',
      input: [{ role: 'user', content: 'ping' }],
      tools: [],
      store: false,
    }, { signal });
    return { status: 'connected' as const, model };
  }
  session(instructions: string, messages: { role: 'user' | 'assistant'; content: string }[]): ModelSession {
    // Provider transcript and reasoning items stay inside this adapter.
    const api = new OpenAI();
    const input: ResponseInput = messages.map(message => ({ ...message }));
    return {
      async complete(tools: ToolDefinition[], signal: AbortSignal) {
        const functions: FunctionTool[] = tools.map(t => ({ type: 'function', name: t.name, description: t.description ?? t.name, parameters: t.inputSchema, strict: false }));
        const response = await api.responses.create({ model: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini', instructions, input, tools: functions, store: false }, { signal });
        input.push(...toResponseInputItems(response.output));
        return { text: response.output_text, calls: response.output.filter(o => o.type === 'function_call').map(c => ({ id: c.call_id, name: c.name, arguments: c.arguments })) };
      },
      acceptResult(callId, output) { input.push({ type: 'function_call_output', call_id: callId, output }); },
    };
  }
}
