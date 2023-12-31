import axios from "axios";
import { NextResponse } from "next/server";
import { z } from "zod";

export const maxDuration = 30;

const textContentSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});

const imageContentSchema = z.object({
  type: z.literal("image_url"),
  image_url: z.object({
    url: z.string().url(),
  }),
});

const contentSchema = z.union([textContentSchema, imageContentSchema]);

const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.array(contentSchema),
});

const chatRequestSchema = z.object({
  messages: z.array(messageSchema),
});

const OPENAI_URL = "https://api.openai.com/v1/chat/completions" as const;

const axiosInstance = axios.create({
  baseURL: OPENAI_URL,
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
  },
});

export async function POST(request: Request) {
  try {
    const requestBody = await request.json();
    const parsedRequest = chatRequestSchema.safeParse(requestBody);

    if (!parsedRequest.success) {
      console.log("Invalid schema", parsedRequest.error);
      return NextResponse.json({ error: "Invalid schema", success: false });
    }

    const clonedMessages = parsedRequest.data.messages.map((message) => ({
      ...message,
      content: message.content.map((content) =>
        content.type === "image_url"
          ? {
              type: content.type,
              image_url: { url: content.image_url.url },
            }
          : content
      ),
    }));

    console.log("clonedMessages", JSON.stringify(clonedMessages));

    const payload = {
      model: "gpt-4-vision-preview",
      messages: clonedMessages,
      temperature: 0,
      seed: 0,
      max_tokens: 4000
    };

    const response = await axiosInstance.post("", payload);

    const firstMessage = response.data.choices[0].message;
    return NextResponse.json({ success: true, message: firstMessage });
  } catch (error) {
    console.log(error)
    return NextResponse.json({ success: false, message: null });
  }
}
