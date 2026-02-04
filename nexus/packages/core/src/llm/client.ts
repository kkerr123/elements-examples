import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, ContentBlock, ToolUseBlock, TextBlock } from '@anthropic-ai/sdk/resources/messages';

export interface LLMConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

export interface Tool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolResult {
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export interface StreamCallbacks {
  onText?: (text: string) => void;
  onToolUse?: (toolUse: ToolUseBlock) => void;
  onComplete?: (response: LLMResponse) => void;
  onError?: (error: Error) => void;
}

export interface LLMResponse {
  content: ContentBlock[];
  stopReason: string | null;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  toolUses: ToolUseBlock[];
  textContent: string;
}

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_MAX_TOKENS = 8192;

/**
 * Anthropic Claude client wrapper with streaming support
 */
export class LLMClient {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;

  constructor(config: LLMConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
    });
    this.model = config.model || DEFAULT_MODEL;
    this.maxTokens = config.maxTokens || DEFAULT_MAX_TOKENS;
  }

  /**
   * Send a message and get a response (non-streaming)
   */
  async sendMessage(
    messages: MessageParam[],
    options: {
      systemPrompt?: string;
      tools?: Tool[];
    } = {}
  ): Promise<LLMResponse> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: options.systemPrompt,
      messages,
      tools: options.tools,
    });

    return this.parseResponse(response);
  }

  /**
   * Send a message with streaming
   */
  async streamMessage(
    messages: MessageParam[],
    callbacks: StreamCallbacks,
    options: {
      systemPrompt?: string;
      tools?: Tool[];
    } = {}
  ): Promise<LLMResponse> {
    const contentBlocks: ContentBlock[] = [];
    let currentTextBlock: { type: 'text'; text: string } | null = null;
    let currentToolUse: ToolUseBlock | null = null;
    let inputTokens = 0;
    let outputTokens = 0;
    let stopReason: string | null = null;

    try {
      const stream = this.client.messages.stream({
        model: this.model,
        max_tokens: this.maxTokens,
        system: options.systemPrompt,
        messages,
        tools: options.tools,
      });

      for await (const event of stream) {
        switch (event.type) {
          case 'message_start':
            inputTokens = event.message.usage?.input_tokens || 0;
            break;

          case 'content_block_start':
            if (event.content_block.type === 'text') {
              currentTextBlock = { type: 'text', text: '' };
            } else if (event.content_block.type === 'tool_use') {
              currentToolUse = {
                type: 'tool_use',
                id: event.content_block.id,
                name: event.content_block.name,
                input: {},
              };
            }
            break;

          case 'content_block_delta':
            if (event.delta.type === 'text_delta' && currentTextBlock) {
              currentTextBlock.text += event.delta.text;
              callbacks.onText?.(event.delta.text);
            } else if (event.delta.type === 'input_json_delta' && currentToolUse) {
              // Accumulate JSON input for tool use
              // Note: We need to parse the full input at content_block_stop
            }
            break;

          case 'content_block_stop':
            if (currentTextBlock) {
              contentBlocks.push(currentTextBlock as TextBlock);
              currentTextBlock = null;
            } else if (currentToolUse) {
              contentBlocks.push(currentToolUse);
              callbacks.onToolUse?.(currentToolUse);
              currentToolUse = null;
            }
            break;

          case 'message_delta':
            stopReason = event.delta.stop_reason;
            outputTokens = event.usage?.output_tokens || 0;
            break;
        }
      }

      const response: LLMResponse = {
        content: contentBlocks,
        stopReason,
        usage: { inputTokens, outputTokens },
        toolUses: contentBlocks.filter((b): b is ToolUseBlock => b.type === 'tool_use'),
        textContent: contentBlocks
          .filter((b): b is TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join(''),
      };

      callbacks.onComplete?.(response);
      return response;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      callbacks.onError?.(err);
      throw err;
    }
  }

  /**
   * Continue a conversation with tool results
   */
  async continueWithToolResults(
    messages: MessageParam[],
    toolResults: ToolResult[],
    callbacks: StreamCallbacks,
    options: {
      systemPrompt?: string;
      tools?: Tool[];
    } = {}
  ): Promise<LLMResponse> {
    // Add tool results to messages
    const updatedMessages: MessageParam[] = [
      ...messages,
      {
        role: 'user',
        content: toolResults.map((result) => ({
          type: 'tool_result' as const,
          tool_use_id: result.tool_use_id,
          content: result.content,
          is_error: result.is_error,
        })),
      },
    ];

    return this.streamMessage(updatedMessages, callbacks, options);
  }

  /**
   * Parse a non-streaming response
   */
  private parseResponse(response: Anthropic.Message): LLMResponse {
    const toolUses = response.content.filter(
      (b): b is ToolUseBlock => b.type === 'tool_use'
    );

    const textContent = response.content
      .filter((b): b is TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    return {
      content: response.content,
      stopReason: response.stop_reason,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      toolUses,
      textContent,
    };
  }

  /**
   * Update the model
   */
  setModel(model: string): void {
    this.model = model;
  }

  /**
   * Update max tokens
   */
  setMaxTokens(maxTokens: number): void {
    this.maxTokens = maxTokens;
  }
}
