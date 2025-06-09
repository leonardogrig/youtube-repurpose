import { SpeechSegment } from "@/components/types";
import { NextRequest, NextResponse } from "next/server";

// Schema for Twitter post generation response
const TwitterPostSchema = {
  type: "object",
  properties: {
    twitter_post: {
      type: "object",
      description: "Generated Twitter/X post with multiple variations",
      properties: {
        main_post: {
          type: "string",
          description: "The primary Twitter post text (under 280 characters)",
        },
        alternative_posts: {
          type: "array",
          description: "Alternative versions of the post",
          items: {
            type: "string",
          },
        },
        hashtags: {
          type: "array",
          description: "Relevant hashtags for the post",
          items: {
            type: "string",
          },
        },
        hook_style: {
          type: "string",
          description:
            "The style of hook used (e.g., 'question', 'statistic', 'controversial', 'story')",
        },
      },
      required: ["main_post", "alternative_posts", "hashtags", "hook_style"],
    },
  },
  required: ["twitter_post"],
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
  topicInfo: any,
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
          { role: "user", content: JSON.stringify({ segments, topicInfo }) },
        ],
        response_format: {
          type: "json_object",
          schema: TwitterPostSchema,
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
    const topicInfo = body.topicInfo;

    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      return NextResponse.json(
        { error: "Invalid or empty segments data" },
        { status: 400 }
      );
    }

    if (!topicInfo || !topicInfo.title) {
      return NextResponse.json(
        { error: "Invalid topic information" },
        { status: 400 }
      );
    }

    // Build a detailed prompt for Twitter post generation
    const prompt = `
      You are a social media expert specializing in creating engaging Twitter/X posts that drive high engagement.
      
      You're given:
      1. Video segment transcription text
      2. Topic information including title, description, and key points
      
      Your task is to create compelling Twitter/X posts that:
      - Are under 280 characters for the main post
      - Use proven engagement hooks (questions, statistics, controversial takes, stories, etc.)
      - Include the most interesting/valuable insight from the content
      - Are optimized for social media virality
      - Include relevant hashtags (3-5 max)
      - Provide 2-3 alternative versions with different angles
      
      Hook styles to consider:
      - "Question": Start with an intriguing question
      - "Statistic": Lead with a surprising number or fact
      - "Controversial": Challenge common assumptions
      - "Story": Begin with a mini narrative
      - "Listicle": "X things that..."
      - "Problem/Solution": Present a problem then hint at solution
      
      Guidelines:
      - Make it conversational and authentic
      - Include specific details when possible
      - Create curiosity that makes people want to watch the video
      - Avoid generic business speak
      - Use line breaks for readability when needed
      - Don't oversell - let the value speak for itself
      
      Focus on the most shareable, valuable, or surprising aspect of the content.
      
      Example output format:
      {
        "twitter_post": {
          "main_post": "Ever wonder why most developers avoid web scraping?\\n\\nI used to think it was too complex...\\n\\nTurns out there's a simple reason (and an even simpler solution) 🧵",
          "alternative_posts": [
            "Web scraping doesn't have to be complicated\\n\\n3 myths that keep developers stuck:",
            "Hot take: Most web scraping tutorials are teaching you wrong\\n\\nHere's what actually works:"
          ],
          "hashtags": ["#WebScraping", "#Developer", "#Programming", "#TechTips"],
          "hook_style": "question"
        }
      }
    `;

    // Try with different models in sequence until one works
    const models = [
      "google/gemini-2.0-flash-001",
      "anthropic/claude-3.5-sonnet",
      "openai/gpt-4o-2024-11-20",
    ];

    let data;
    let selectedModel = "";
    let error = null;

    // Try each model in sequence until one works
    for (const model of models) {
      try {
        console.log(`Trying Twitter post generation with model: ${model}`);
        data = await callOpenRouterWithModel(
          apiKey,
          segments,
          topicInfo,
          prompt,
          model
        );
        selectedModel = model;
        console.log(`Successfully generated Twitter post with model: ${model}`);
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

      // Return a fallback Twitter post
      const fallbackPost = {
        main_post: `${topicInfo.title}\n\nWatch the full explanation in this video clip 👇`,
        alternative_posts: [
          `Interesting insight about ${topicInfo.title.toLowerCase()}`,
          `Here's what you need to know about ${topicInfo.title.toLowerCase()}`,
        ],
        hashtags: ["#Video", "#Content", "#Learn"],
        hook_style: "direct",
      };

      return NextResponse.json(
        {
          error: "Failed to generate Twitter post with any available model",
          twitterPost: fallbackPost,
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
      if (!parsedContent || !parsedContent.twitter_post) {
        console.log("Expected structure not found, attempting fallback...");

        // Fallback: create a simple Twitter post
        const fallbackPost = {
          main_post: `${topicInfo.title}\n\n${topicInfo.description}\n\nWatch the full explanation 👇`,
          alternative_posts: [
            `Key insight: ${topicInfo.description}`,
            `${topicInfo.title} - explained in this video clip`,
          ],
          hashtags: ["#Video", "#Learn", "#Insights"],
          hook_style: "direct",
        };

        return NextResponse.json({
          twitterPost: fallbackPost,
          warning: "Used fallback Twitter post generation",
          model: selectedModel,
        });
      }

      // Validate the Twitter post structure
      const post = parsedContent.twitter_post;
      if (
        !post.main_post ||
        !Array.isArray(post.alternative_posts) ||
        !Array.isArray(post.hashtags)
      ) {
        throw new Error("Invalid Twitter post structure");
      }

      // Ensure main post is under 280 characters
      if (post.main_post.length > 280) {
        console.log("Main post too long, truncating...");
        post.main_post = post.main_post.substring(0, 275) + "...";
      }

      return NextResponse.json({
        twitterPost: post,
        model: selectedModel,
      });
    } catch (e) {
      console.error("Error parsing Twitter post content:", e);
      console.log("Raw content that failed to parse:", content);

      // Return fallback
      const fallbackPost = {
        main_post: `${topicInfo.title}\n\nInteresting insights in this video clip 👇`,
        alternative_posts: [
          `Check out this insight about ${topicInfo.title.toLowerCase()}`,
          `${topicInfo.description}`,
        ],
        hashtags: ["#Video", "#Content", "#Insights"],
        hook_style: "direct",
      };

      return NextResponse.json(
        {
          twitterPost: fallbackPost,
          error: "Failed to parse Twitter post, returning fallback",
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
        error: "An error occurred while generating Twitter post",
        details: error instanceof Error ? error.message : "Unknown error",
        twitterPost: null,
      },
      { status: 200 }
    );
  }
}
