import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const allowedFieldTypes = [
  'text',
  'textarea',
  'number',
  'date',
  'time',
  'select',
  'checkbox',
  'photo',
  'signature',
  'table'
];

const draftSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['template', 'report_layout', 'form_pages', 'confidence', 'warnings', 'review_checklist'],
  properties: {
    template: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'description', 'category', 'industry', 'report_type', 'fields_schema'],
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        category: { type: 'string' },
        industry: { type: 'string' },
        report_type: { type: 'string' },
        fields_schema: {
          type: 'object',
          additionalProperties: false,
          required: ['sections'],
          properties: {
            sections: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['key', 'title', 'description', 'fields'],
                properties: {
                  key: { type: 'string' },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  fields: {
                    type: 'array',
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      required: ['key', 'label', 'type', 'required', 'placeholder', 'options', 'help_text'],
                      properties: {
                        key: { type: 'string' },
                        label: { type: 'string' },
                        type: { type: 'string', enum: allowedFieldTypes },
                        required: { type: 'boolean' },
                        placeholder: { type: 'string' },
                        options: { type: 'array', items: { type: 'string' } },
                        help_text: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    report_layout: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'description', 'blocks'],
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        blocks: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'type', 'title', 'source_section', 'fields'],
            properties: {
              id: { type: 'string' },
              type: {
                type: 'string',
                enum: ['header', 'summary', 'details', 'table', 'photo_grid', 'signature', 'approval', 'metrics_cards']
              },
              title: { type: 'string' },
              source_section: { type: 'string' },
              fields: { type: 'array', items: { type: 'string' } }
            }
          }
        }
      }
    },
    form_pages: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['page_key', 'page_title', 'description', 'fields'],
        properties: {
          page_key: { type: 'string' },
          page_title: { type: 'string' },
          description: { type: 'string' },
          fields: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['key', 'label', 'type', 'required', 'placeholder', 'options', 'help_text'],
              properties: {
                key: { type: 'string' },
                label: { type: 'string' },
                type: { type: 'string', enum: allowedFieldTypes },
                required: { type: 'boolean' },
                placeholder: { type: 'string' },
                options: { type: 'array', items: { type: 'string' } },
                help_text: { type: 'string' }
              }
            }
          }
        }
      }
    },
    confidence: { type: 'number' },
    warnings: { type: 'array', items: { type: 'string' } },
    review_checklist: { type: 'array', items: { type: 'string' } }
  }
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function extractOutputText(payload: any) {
  if (typeof payload?.output_text === 'string') return payload.output_text;

  const content = payload?.output
    ?.flatMap((item: any) => item.content || [])
    ?.find((part: any) => part.type === 'output_text' || typeof part.text === 'string');

  return content?.text || '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed.' }, 405);
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return jsonResponse({ success: false, error: 'OPENAI_API_KEY is not configured.' }, 500);
    }

    const { bucket, path, fileName, organizationId, notes } = await req.json();

    if (!bucket || !path) {
      return jsonResponse({ success: false, error: 'Missing PDF storage bucket or path.' }, 400);
    }

    if (fileName && !String(fileName).toLowerCase().endsWith('.pdf')) {
      return jsonResponse({ success: false, error: 'Only PDF report files are supported.' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const authorization = req.headers.get('Authorization') || '';

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } }
    });

    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(path);

    if (downloadError || !fileBlob) {
      return jsonResponse({
        success: false,
        error: downloadError?.message || 'Unable to download source PDF.'
      }, 400);
    }

    const base64Pdf = arrayBufferToBase64(await fileBlob.arrayBuffer());
    const model = Deno.env.get('OPENAI_MODEL') || 'gpt-5.5';

    const prompt = [
      'You are designing a WorkLedger report template from a reference PDF.',
      'Return a production-ready draft that a construction operations admin can review.',
      'Do not claim the draft is final. Use warnings for anything uncertain or missing.',
      'Use stable snake_case keys. Keep field labels professional and concise.',
      'Each field must use one of the allowed field types in the JSON schema.',
      'Map visible PDF sections into form_pages and report_layout blocks.',
      'Include signature, approval, photo, table, and metrics blocks only when the PDF supports them.',
      `Organization ID: ${organizationId || 'unknown'}.`,
      notes ? `Reviewer notes: ${notes}` : 'Reviewer notes: none.'
    ].join('\n');

    const openaiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: prompt },
              {
                type: 'input_file',
                filename: fileName || 'reference-report.pdf',
                file_data: `data:application/pdf;base64,${base64Pdf}`,
                detail: 'high'
              }
            ]
          }
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'workledger_template_import',
            strict: true,
            schema: draftSchema
          }
        }
      })
    });

    const openaiPayload = await openaiResponse.json();
    if (!openaiResponse.ok) {
      return jsonResponse({
        success: false,
        error: openaiPayload?.error?.message || 'OpenAI template generation failed.'
      }, 502);
    }

    const outputText = extractOutputText(openaiPayload);
    if (!outputText) {
      return jsonResponse({ success: false, error: 'OpenAI returned no structured draft.' }, 502);
    }

    const draft = JSON.parse(outputText);

    return jsonResponse({
      success: true,
      draft,
      source: { bucket, path, fileName: fileName || 'reference-report.pdf' },
      model
    });
  } catch (error) {
    console.error('generate-report-template failed:', error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Template generation failed.'
    }, 500);
  }
});
