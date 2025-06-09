import { SpeechSegment } from "@/components/types";
import { NextRequest, NextResponse } from "next/server";

// Schema for Twitter post generation with segments
const TwitterPostWithSegmentsSchema = {
  type: "object",
  properties: {
    twitter_posts: {
      type: "array",
      description:
        "A list of Twitter thread posts with their corresponding segment ranges.",
      items: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "A catchy title for this Twitter thread",
          },
          post_content: {
            type: "string",
            description:
              "The complete Twitter thread content formatted with line breaks as a single string",
          },
          start_segment: {
            type: "number",
            description:
              "The index of the first segment in this post (0-based)",
          },
          end_segment: {
            type: "number",
            description: "The index of the last segment in this post (0-based)",
          },
          key_points: {
            type: "array",
            description: "Main key points covered in this Twitter thread",
            items: {
              type: "string",
            },
          },
        },
        required: [
          "title",
          "post_content",
          "start_segment",
          "end_segment",
          "key_points",
        ],
      },
    },
  },
  required: ["twitter_posts"],
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
        "X-Title": "Video Editor - Twitter Post Generation",
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: JSON.stringify(segments) },
        ],
        response_format: {
          type: "json_object",
          schema: TwitterPostWithSegmentsSchema,
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

    // Build a detailed prompt for Twitter thread generation
    const prompt = `
      You are a viral Twitter/X content expert who creates highly engaging Twitter threads that drive massive engagement.
      
      You are given a JSON transcription of a video as an array of segments.
      Each segment has 'start' (seconds), 'end' (seconds), and 'text' (transcribed speech).

      Your task is to analyze the entire transcription and create a compelling Twitter thread (5 - 8 posts(tweets)). 
      
      Each post of the thread should:
      
      1. Cover a coherent section of the video (specify start_segment and end_segment indices)
      2. Be formatted as a complete Twitter thread as a SINGLE STRING with line breaks
      3. Follow this EXACT style and structure:
      
      EXAMPLE FORMAT (first post):
      
      Google's CEO just had the most important AI interview of 2025.
      
      He revealed mind-blowing facts about artificial general intelligence that 99% of people wouldn't know...
      
      Including when the singularity actually happens.
      
      Here are my top 8 takeaways:
      (No. 6 will terrify you)
      
      OR (second post):
      
      1. Token Explosion
      
      Google's Gemini: 9.7 trillion → 480 trillion tokens per month.
      
      That's 50x growth in 12 months.
      
      Each token = someone getting an "aha moment" from AI.

      REQUIREMENTS:
      - Start with a hook that creates curiosity and urgency
      - Use short, punchy sentences
      - Include specific numbers, statistics, or facts when available
      - Create intrigue with phrases like "99% of people don't know this" or "This will shock you"
      - Use line breaks strategically for readability
      - Make numbered points when listing takeaways
      - Focus on the most valuable, surprising, or controversial insights
      - Make people want to watch the video to learn more
      
      Guidelines for segment selection:
      - Each suggestion should cover consecutive segments (start_segment to end_segment)
      - Segments should contain complete thoughts or concepts
      - Prioritize content with high viral potential (shocking facts, valuable insights, controversial takes)
      - Each post should typically represent 30 seconds to 3 minutes of video content
      
      CRITICAL: You MUST return the response in this EXACT JSON format:
      
      {
        "twitter_posts": [
          {
            "title": "Catchy Title Here",
            "post_content": "Complete Twitter post as single string with \\n for line breaks",
            "start_segment": 0,
            "end_segment": 5,
            "key_points": ["Point 1", "Point 2", "Point 3"]
          }
        ]
      }
    `;

    // Try with different models in sequence until one works
    const models = [
      "google/gemini-2.5-flash-preview-05-20",
      "openai/gpt-4o-mini",
    ];

    let data;
    let selectedModel = "";
    let error = null;

    // Try each model in sequence until one works
    for (const model of models) {
      try {
        console.log(`Trying Twitter post generation with model: ${model}`);
        data = await callOpenRouterWithModel(apiKey, segments, prompt, model);
        selectedModel = model;
        console.log(
          `Successfully processed Twitter post generation with model: ${model}`
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
      console.error("All models failed for Twitter post generation:", error);
      return NextResponse.json(
        {
          error: "Failed to generate Twitter posts with any available model",
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
        parsedContent = JSON.parse(content);
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
            postContent = "Generated Twitter thread content";
          }

          return {
            title: post.title || "Generated Thread",
            post_content: postContent,
            start_segment: post.start_segment || 0,
            end_segment: post.end_segment || Math.max(0, segments.length - 1),
            key_points: post.key_points || ["Generated content"],
          };
        });

        return NextResponse.json({
          twitterPosts: convertedPosts,
          model: selectedModel,
        });
      }

      // Validate the structure
      if (!parsedContent || !parsedContent.twitter_posts) {
        console.log("Expected structure not found, attempting fallback...");

        // Fallback: create a simple post covering all segments
        const fallbackPost = {
          title: "Full Video Content",
          post_content:
            "Interesting insights from this video.\n\nWatch the full explanation to learn more.",
          start_segment: 0,
          end_segment: segments.length - 1,
          key_points: ["Complete video content"],
        };

        return NextResponse.json({
          twitterPosts: [fallbackPost],
          warning: "Used fallback Twitter post generation",
          model: selectedModel,
        });
      }

      // Validate each post has required fields and valid segment indices
      const validatedPosts = parsedContent.twitter_posts.filter((post: any) => {
        return (
          post.title &&
          post.post_content &&
          typeof post.start_segment === "number" &&
          typeof post.end_segment === "number" &&
          post.start_segment >= 0 &&
          post.end_segment < segments.length &&
          post.start_segment <= post.end_segment &&
          Array.isArray(post.key_points)
        );
      });

      return NextResponse.json({
        twitterPosts: validatedPosts,
        model: selectedModel,
      });
    } catch (e) {
      console.error("Error parsing Twitter post content:", e);
      console.log("Raw content that failed to parse:", content);

      // Return fallback
      const fallbackPost = {
        title: "Video Content",
        post_content:
          "Valuable insights from this video.\n\nWatch to learn more.",
        start_segment: 0,
        end_segment: Math.max(0, segments.length - 1),
        key_points: ["Video content"],
      };

      return NextResponse.json(
        {
          twitterPosts: [fallbackPost],
          error: "Failed to parse Twitter posts, returning fallback",
          details: e instanceof Error ? e.message : "Unknown error",
          model: selectedModel,
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error("Error in Twitter post generation:", error);

    return NextResponse.json(
      {
        error: "An error occurred while generating Twitter posts",
        details: error instanceof Error ? error.message : "Unknown error",
        twitterPosts: [],
      },
      { status: 200 }
    );
  }
}
