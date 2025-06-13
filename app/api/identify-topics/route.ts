import { SpeechSegment } from "@/components/types";
import { NextRequest, NextResponse } from "next/server";

// Schema for X post generation with time ranges
const XPostWithTimeRangesSchema = {
  type: "object",
  properties: {
    x_posts: {
      type: "array",
      description:
        "A list of X thread posts with their corresponding time ranges in seconds.",
      items: {
        type: "object",
        properties: {
          post_content: {
            type: "string",
            description:
              "The complete Twitter thread content formatted with line breaks as a single string",
          },
          start_time: {
            type: "number",
            description:
              "The start time in seconds for this post content in the video",
          },
          end_time: {
            type: "number",
            description:
              "The end time in seconds for this post content in the video",
          },
        },
        required: ["post_content", "start_time", "end_time"],
        additionalProperties: false,
      },
    },
  },
  required: ["x_posts"],
  additionalProperties: false,
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
  // Clean up segments data - only keep start, end, and text
  const cleanedSegments = segments.map((segment) => ({
    start_time: segment.start,
    end_time: segment.end,
    transcription: segment.text,
  }));

  console.log(
    "Cleaned segments data:",
    JSON.stringify(cleanedSegments.slice(0, 3), null, 2)
  );

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://localhost:3000",
        "X-Title": "Video Editor - Twitter Post Generation",
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: JSON.stringify(cleanedSegments) },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "x_posts_schema",
            strict: true,
            schema: XPostWithTimeRangesSchema,
          },
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

    // Calculate content duration to adjust number of threads
    const totalDuration =
      segments.length > 0 ? segments[segments.length - 1].end : 0;
    const isLongForm = totalDuration > 3600; // More than 1 hour

    const expectedThreadCount = isLongForm ? "8-15 threads" : "5-8 threads";
    const contentAnalysisDepth = isLongForm
      ? "multiple major topics and subtopics"
      : "key topics and insights";

    // Build a detailed prompt for Twitter thread generation
    const prompt = `
You are an X (Twitter) content expert creating viral threads for an AI-focused audience.

TARGET TOPICS (Priority Order):
- AI developments, breakthroughs, and research
- AI tools and models (ChatGPT, Claude, Gemini, etc.)
- Machine Learning and Deep Learning innovations
- AI startup funding and market trends
- Developer tools enhanced by AI
- AI predictions and future implications

INPUT: JSON transcription with time segments containing 'start_time', 'end_time' (in seconds), and 'transcription' fields.
ANALYSIS: ${Math.round(totalDuration / 60)} minutes (${
      isLongForm ? "LONG-FORM" : "SHORT-FORM"
    })
OUTPUT: ${expectedThreadCount} posts extracting ${contentAnalysisDepth}

CORE REQUIREMENT: Content MUST match transcription text exactly.

FORMATTING RULES:
- Use line breaks for readability (separate sentences/ideas with \\n\\n)
- Add relevant emojis when they enhance the message (🤖 🚀 💡 🔥 ⚡ 🎯 📈 🛠️ 🧠 💻)
- NO hashtags - they reduce engagement on modern X
- Keep each post under 280 characters including line breaks
- Use conversational, engaging tone
- Break long thoughts into multiple short, punchy sentences

PROCESS:
1. Scan all segments for AI-relevant content
2. Identify specific time ranges containing target topics
3. Write posts using ONLY content from selected time ranges
4. Format with proper line breaks and emojis
5. Verify post content matches transcription text before finalizing

TIME RANGE SELECTION RULES:
- Maximum 5 minutes (300 seconds) per post
- start_time and end_time must be in seconds and contain the referenced topic
- No mixing unrelated topics within a single post
- Skip segments with minimal or empty transcription
- Ensure sequential logical flow

CONTENT VERIFICATION:
- Direct quotes must appear in selected time ranges
- Claims must be supported by transcription text
- Numbers and data must exist in transcription
- Topics discussed must match transcription content

THREAD STRUCTURE:
POST 1: Hook with most compelling insight from specific time range
POSTS 2-N: Sequential narrative using different time ranges (1/, 2/, 3/ format)

EXAMPLE FORMAT:
"🚀 AI is dramatically increasing engineering velocity.

While 30% of code now uses AI suggestions, Google's overall engineering productivity jumped 10%.

This frees up engineers for more creative problem-solving and brainstorming.

The result? Coding is becoming more fun than ever."

FORBIDDEN:
- Adding information not in transcription
- Using hashtags (#)
- Single-line walls of text without breaks
- Using time range about Topic A to write about Topic B
- Creating content that "sounds good" but doesn't match transcription
- Mixing unrelated time ranges

REQUIRED JSON OUTPUT:
{
  "x_posts": [
    {
      "post_content": "[Content with line breaks and emojis matching time range exactly]",
      "start_time": 120.5,
      "end_time": 185.2
    },
    {
      "post_content": "1/ [Content with line breaks and emojis matching time range exactly]",
      "start_time": 240.1,
      "end_time": 305.7
    }
  ]
}
`;

    // Try with different models in sequence until one works
    const models = [
      "anthropic/claude-sonnet-4",
      "google/gemini-2.5-flash-preview-05-20",
      "openai/gpt-4o-mini",
    ];

    let data;
    let selectedModel = "";
    let error = null;

    // Try each model in sequence until one works
    for (const model of models) {
      try {
        console.log(`Trying X post generation with model: ${model}`);
        data = await callOpenRouterWithModel(apiKey, segments, prompt, model);
        selectedModel = model;
        console.log(
          `Successfully processed X post generation with model: ${model}`
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
      console.error("All models failed for X post generation:", error);
      return NextResponse.json(
        {
          error: "Failed to generate X posts with any available model",
          twitterPosts: [],
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
        // First try to parse as direct JSON
        try {
          parsedContent = JSON.parse(content);
        } catch (e) {
          // If that fails, try to extract JSON from markdown code blocks
          console.log(
            "Direct JSON parsing failed, trying to extract from markdown..."
          );

          // Look for JSON within ```json blocks
          const jsonMatch = content.match(/```json\s*\n([\s\S]*?)\n```/);
          if (jsonMatch) {
            console.log("Found JSON in markdown code block");
            parsedContent = JSON.parse(jsonMatch[1]);
          } else {
            // Look for any JSON-like structure
            const jsonStart = content.indexOf("{");
            const jsonEnd = content.lastIndexOf("}");
            if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
              console.log("Attempting to extract JSON from text...");
              const jsonText = content.substring(jsonStart, jsonEnd + 1);
              parsedContent = JSON.parse(jsonText);
            } else {
              throw new Error("No valid JSON found in response");
            }
          }
        }
      } else {
        throw new Error(`Unexpected content type: ${typeof content}`);
      }

      console.log("Parsed content:", JSON.stringify(parsedContent, null, 2));

      // Handle case where AI returns array directly instead of wrapped in twitter_posts
      if (Array.isArray(parsedContent)) {
        console.log(
          "AI returned array directly, converting to expected format..."
        );

        // Convert the array format to our expected format
        const convertedPosts = parsedContent.map((post: any) => {
          let postContent = "";

          // If it has tweets array, join them with line breaks
          if (post.tweets && Array.isArray(post.tweets)) {
            postContent = post.tweets.join("\n\n");
          } else if (post.post_content) {
            postContent = post.post_content;
          } else {
            postContent = "Generated X thread content";
          }

          return {
            post_content: postContent,
            start_time: post.start_time || 0,
            end_time:
              post.end_time ||
              Math.max(0, segments[segments.length - 1]?.end || 0),
          };
        });

        return NextResponse.json({
          twitterPosts: convertedPosts,
          model: selectedModel,
        });
      }

      // Validate the structure
      if (!parsedContent || !parsedContent.x_posts) {
        console.log("Expected structure not found, attempting fallback...");

        // Fallback: create a simple post covering all segments
        const fallbackPost = {
          post_content:
            "Interesting insights from this video.\n\nWatch the full explanation to learn more.",
          start_time: 0,
          end_time: segments[segments.length - 1]?.end || 0,
        };

        return NextResponse.json({
          twitterPosts: [fallbackPost],
          warning: "Used fallback X post generation",
          model: selectedModel,
        });
      }

      // Validate each post has required fields - preserve original time ranges
      const validatedPosts = parsedContent.x_posts.filter((post: any) => {
        const isValid =
          post.post_content &&
          typeof post.start_time === "number" &&
          typeof post.end_time === "number" &&
          post.start_time >= 0 &&
          post.end_time >= 0 &&
          post.start_time <= post.end_time;

        if (!isValid) {
          console.log(
            "Filtered out invalid post - time range:",
            post.start_time,
            "to",
            post.end_time
          );
        } else {
          console.log(
            "Validated post - time range:",
            post.start_time,
            "to",
            post.end_time
          );
        }

        return isValid;
      });

      return NextResponse.json({
        twitterPosts: validatedPosts,
        model: selectedModel,
      });
    } catch (e) {
      console.error("Error parsing X post content:", e);
      console.log("Raw content that failed to parse:", content);

      // Return fallback
      const fallbackPost = {
        post_content:
          "Valuable insights from this video.\n\nWatch to learn more.",
        start_time: 0,
        end_time: Math.max(0, segments[segments.length - 1]?.end || 0),
      };

      return NextResponse.json(
        {
          twitterPosts: [fallbackPost],
          error: "Failed to parse X posts, returning fallback",
          details: e instanceof Error ? e.message : "Unknown error",
          model: selectedModel,
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error("Error in X post generation:", error);

    return NextResponse.json(
      {
        error: "An error occurred while generating X posts",
        details: error instanceof Error ? error.message : "Unknown error",
        twitterPosts: [],
      },
      { status: 200 }
    );
  }
}
