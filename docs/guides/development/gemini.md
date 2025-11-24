# Google Gemini Integration

This document provides an overview of the Google Gemini integration within the project for AI-powered analytics.

## Overview

The project leverages Google Gemini models to provide advanced AI and analytics capabilities. The integration is designed to be seamless, allowing users to select Gemini as an AI provider through the admin dashboard and utilize its power for various tasks.

## Supported Models

The following Gemini models are supported:

- `gemini-1.5-pro` (Default)
- `gemini-1.5-flash`
- `gemini-1.0-pro`

## Implementation Details

The core logic for the Gemini integration resides in `packages/ai-analytics/src/providers/google.ts`.

### `GoogleProvider` Class

The `GoogleProvider` class is responsible for all communication with the Google Gemini API. It extends the `BaseLLMProvider` and implements the necessary methods for making requests and handling responses.

### API Endpoint

The integration uses the following Google Cloud API endpoint for generating content:

```
https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
```

### Key Methods

- **`chat(request: LLMRequest): Promise<LLMResponse>`**: This is the primary method for sending a prompt to the Gemini API and receiving a response. It constructs the request payload, sends it to the API, and processes the response.
- **`test(): Promise<{ success: boolean; latencyMs?: number; error?: string }>`**: This method allows for testing the connection and authentication with the Gemini API by sending a simple test prompt.

## Configuration

To use the Google Gemini provider, it must be configured in the **Admin Dashboard**. This involves:

1.  Selecting "Google Gemini" as the AI provider.
2.  Providing a valid Google Cloud API key.

## API Integration

The backend API includes a schema for AI analytics that allows specifying the LLM provider. The `LLMProvider` enum includes `gemini` as a valid option.

File: `apps/api/src/openapi/schemas/ai-analytics.ts`
```typescript
LLMProvider: z.enum(['openai', 'anthropic', 'gemini', 'local']),
```
