import { SpeechSegment } from "@/components/types";
import { NextRequest, NextResponse } from "next/server";

// Schema for topic identification response
const TopicIdentificationSchema = {
  type: "object",
  properties: {
    topic_suggestions: {
      type: "array",
      description:
        "A list of suggested topics with their corresponding segment ranges.",
      items: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "A catchy title for this topic/section",
          },
          description: {
            type: "string",
            description: "A brief description of what this section covers",
          },
          start_segment: {
            type: "number",
            description:
              "The index of the first segment in this topic (0-based)",
          },
          end_segment: {
            type: "number",
            description:
              "The index of the last segment in this topic (0-based)",
          },
          key_points: {
            type: "array",
            description: "Main key points covered in this topic",
            items: {
              type: "string",
            },
          },
          social_media_appeal: {
            type: "string",
            description:
              "Why this section would work well for social media (Twitter/X)",
          },
        },
        required: [
          "title",
          "description",
          "start_segment",
          "end_segment",
          "key_points",
          "social_media_appeal",
        ],
      },
    },
  },
  required: ["topic_suggestions"],
};

// Add API route configuration
export const config = {
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: Infinity,
    },
  },
};

async function callOpenRouterWithModel(
  apiKey: string,
  segments: SpeechSegment[],
  prompt: string,
  model: string
) {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://localhost:3000",
        "X-Title": "Video Editor - Topic Identification",
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: JSON.stringify(segments) },
        ],
        response_format: {
          type: "json_object",
          schema: TopicIdentificationSchema,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    console.error(`OpenRouter API error with model ${model}:`, errorData);
    throw new Error(
      `Failed to process with model ${model}: ${
        errorData.error || "Unknown error"
      }`
    );
  }

  return await response.json();
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "OpenRouter API key is not configured. Please add OPENROUTER_API_KEY to your environment variables.",
        },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    const segments = body.segments as SpeechSegment[];

    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      return NextResponse.json(
        { error: "Invalid or empty segments data" },
        { status: 400 }
      );
    }

    // Build a detailed prompt for topic identification
    const prompt = `
      You are given a JSON transcription of a video as an array of segments.
      Each segment has 'start' (seconds), 'end' (seconds), and 'text' (transcribed speech).

      Your task is to analyze the entire transcription and identify 3-5 main topics/sections that would work well as standalone social media content (especially Twitter/X posts with video clips).

      For each topic suggestion:
      1. Identify a coherent section that covers a complete thought or concept
      2. The section should be engaging and self-contained
      3. It should be suitable for social media (interesting, valuable, or entertaining)
      4. Specify which segments (by index) should be included
      5. The segment range can span multiple consecutive segments (e.g., segments 5-12)

      Guidelines:
      - Look for complete ideas, stories, tips, or key insights
      - Avoid fragments or incomplete thoughts
      - Prioritize content that has social media appeal (educational, entertaining, or thought-provoking)
      - Each suggestion should typically be 30 seconds to 2 minutes long
      - Segments should be consecutive (start_segment to end_segment)

      Example output format:
      {
        "topic_suggestions": [
          {
            "title": "The Main Problem with Current Approaches",
            "description": "Explains why traditional methods fail and introduces a better solution",
            "start_segment": 2,
            "end_segment": 8,
            "key_points": ["Traditional method limitations", "Why current solutions don't work", "Introduction to better approach"],
            "social_media_appeal": "Challenges common assumptions and provides valuable insights that developers would want to share"
          }
        ]
      }
      
      Focus on quality over quantity - it's better to have 3 excellent suggestions than 5 mediocre ones.
    `;

    // Try with different models in sequence until one works
    const models = [
      "google/gemini-2.0-flash-001",
      "google/gemini-2.5-pro-exp-03-25:free",
      "openai/gpt-4o-2024-11-20",
    ];

    let data;
    let selectedModel = "";
    let error = null;

    // Try each model in sequence until one works
    for (const model of models) {
      try {
        console.log(`Trying topic identification with model: ${model}`);
        data = await callOpenRouterWithModel(apiKey, segments, prompt, model);
        selectedModel = model;
        console.log(
          `Successfully processed topic identification with model: ${model}`
        );
        break;
      } catch (e) {
        console.error(`Error with model ${model}:`, e);
        error = e;
        // Continue to the next model
      }
    }

    // If all models failed, return an error
    if (!data) {
      console.error("All models failed for topic identification:", error);
      return NextResponse.json(
        {
          error: "Failed to identify topics with any available model",
          topicSuggestions: [],
        },
        { status: 200 }
      );
    }

    console.log(
      `OpenRouter API response from ${selectedModel}:`,
      JSON.stringify(data, null, 2)
    );

    // Get the content from the response
    const content = data.choices?.[0]?.message?.content;
    console.log("OpenRouter content:", content);

    // Try to parse the content
    let parsedContent;
    try {
      if (typeof content === "object" && content !== null) {
        parsedContent = content;
      } else if (typeof content === "string") {
        parsedContent = JSON.parse(content);
      } else {
        throw new Error(`Unexpected content type: ${typeof content}`);
      }

      console.log("Parsed content:", JSON.stringify(parsedContent, null, 2));

      // Validate the structure
      if (!parsedContent || !parsedContent.topic_suggestions) {
        console.log("Expected structure not found, attempting fallback...");

        // Fallback: create a simple suggestion covering all segments
        const fallbackSuggestion = {
          title: "Full Video Content",
          description: "Complete video transcription",
          start_segment: 0,
          end_segment: segments.length - 1,
          key_points: ["Complete video content"],
          social_media_appeal: "Full video content for social media sharing",
        };

        return NextResponse.json({
          topicSuggestions: [fallbackSuggestion],
          warning: "Used fallback topic identification",
          model: selectedModel,
        });
      }

      // Validate each suggestion has required fields and valid segment indices
      const validatedSuggestions = parsedContent.topic_suggestions.filter(
        (suggestion: any) => {
          return (
            suggestion.title &&
            suggestion.description &&
            typeof suggestion.start_segment === "number" &&
            typeof suggestion.end_segment === "number" &&
            suggestion.start_segment >= 0 &&
            suggestion.end_segment < segments.length &&
            suggestion.start_segment <= suggestion.end_segment &&
            Array.isArray(suggestion.key_points) &&
            suggestion.social_media_appeal
          );
        }
      );

      return NextResponse.json({
        topicSuggestions: validatedSuggestions,
        model: selectedModel,
      });
    } catch (e) {
      console.error("Error parsing topic identification content:", e);
      console.log("Raw content that failed to parse:", content);

      // Return fallback
      const fallbackSuggestion = {
        title: "Video Content",
        description: "Video transcription content",
        start_segment: 0,
        end_segment: Math.max(0, segments.length - 1),
        key_points: ["Video content"],
        social_media_appeal: "Interesting video content for social sharing",
      };

      return NextResponse.json(
        {
          topicSuggestions: [fallbackSuggestion],
          error: "Failed to parse topic suggestions, returning fallback",
          details: e instanceof Error ? e.message : "Unknown error",
          model: selectedModel,
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error("Error in topic identification:", error);

    return NextResponse.json(
      {
        error: "An error occurred while identifying topics",
        details: error instanceof Error ? error.message : "Unknown error",
        topicSuggestions: [],
      },
      { status: 200 }
    );
  }
}
