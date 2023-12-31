"use client";

import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPaperclip,
  faArrowRight,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import ReactMarkdown from "react-markdown";
import axios from "axios";
import toast from "react-hot-toast";
import { Button } from "./ui/button";

const TAILWIND_DEV = `
  You are an expert Tailwind developer
  You take screenshots of a reference web page from the user, and then build single page apps 
  using Tailwind, HTML and JS.
  You might also be given a screenshot(The second image) of a web page that you have already built, and asked to
  update it to look more like the reference image(The first image).

  - Make sure the app looks exactly like the screenshot.
  - Pay close attention to background color, text color, font size, font family, 
  padding, margin, border, etc. Match the colors and sizes exactly.
  - Use the exact text from the screenshot.
  - Do not add comments in the code such as "<!-- Add other navigation links as needed -->" and "<!-- ... other news items ... -->" in place of writing the full code. WRITE THE FULL CODE.
  - Repeat elements as needed to match the screenshot. For example, if there are 15 items, the code should have 15 items. DO NOT LEAVE comments like "<!-- Repeat for each news item -->" or bad things will happen.
  - For images, use placeholder images from https://placehold.co and include a detailed description of the image in the alt text so that an image generation AI can generate the image later.

  In terms of libraries,

  - Use this script to include Tailwind: <script src="https://cdn.tailwindcss.com"></script>
  - You can use Google Fonts
  - Font Awesome for icons: <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css"></link>

  Return only the full code in <html></html> tags.
  Do not include markdown  or html at the start or end.
`

// Define the structure of a message
type Message = {
  role: "assistant" | "system" | "user";
  content: MessageContent[];
};

type MessageContent = TextContent | ImageContent;

type TextContent = {
  type: "text";
  text: string;
};

type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
  };
};

function ChatContainer() {
  const [images, setImages] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [viewMode, setViewMode] = useState('code')

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setImages((prevImages) => {
        // Calculate how many new images we can add
        const availableSlots = 5 - prevImages.length;
        const newImages = filesArray.slice(0, availableSlots);
        return [...prevImages, ...newImages];
      });
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const sendMessage = async () => {
    setIsSending(true); // Disable send and upload buttons

    // Create the content array for the new user message
    const newUserMessageContent: MessageContent[] = [
      {
        type: "text" as const,
        text: message,
      },
      ...images.map((file) => ({
        type: "image_url" as const,
        // Temporary URLs for rendering - will be replaced by the backend response
        image_url: { url: URL.createObjectURL(file) },
      })),
    ];

    // Create a new user message object
    const newUserMessage: Message = {
      role: "user",
      content: newUserMessageContent as (TextContent | ImageContent)[],
    };

    // Update the messages state to include the new user message
    setMessages((prevMessages) => [...prevMessages, newUserMessage]);

    // Convert images to base64 strings for the backend
    const imagePromises = images.map((file) => {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
      });
    });

    const imageBase64Strings = await Promise.all(imagePromises);

    // Construct the payload with base64 strings
    const payload = {
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: TAILWIND_DEV },
            ...imageBase64Strings.map((base64) => ({
              type: "image_url",
              image_url: { url: base64 },
            })),
          ],
        },
      ],
    };

    try {
      // Send the message to the backend
      const response = await axios.post("/api/openai", payload);

      if (!response.data.success) {
        toast.error(response.data.error);
      }

      const newMessage = { ...response.data.message };
      setMessages((prevMessages) => [...prevMessages, newMessage]);
    } catch (error) {
      toast.error("Failed to send message");
      console.log(error)
      // Optionally remove the user message if sending fails or handle the error as needed
    } finally {
      // Clear the message and images state, regardless of whether the send was successful
      setMessage("");
      setImages([]);
      setIsSending(false); // Re-enable send and upload buttons
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((message, idx) => (
          <div
            key={idx}
            className={`flex mb-4 ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`rounded-lg p-2  ${
                message.role === "user"
                  ? "bg-white text-black"
                  : "bg-white text-black"
              }`}
            >
              {/* Ensure that content is an array before mapping */}
              {Array.isArray(message.content) ? (
                message.content.map((content, index) => {
                  if (content.type === "text") {
                    return <p key={index}>{content.text}</p>;
                  } else if (content.type === "image_url") {
                    return (
                      <img
                        key={index}
                        src={content.image_url.url}
                        alt={`Uploaded by ${message.role}`}
                        className="h-16 w-16 object-cover rounded-lg"
                      />
                    );
                  }
                })
              ) : (
                // Якщо message.content не є масивом, відображаємо його як рядок
                <>
                  <div className="flex space-x-4">
                    <Button onClick={() => setViewMode('code')}>Code</Button>
                    <Button onClick={() => setViewMode('preview')}>Preview</Button>
                    <Button onClick={() => {
                      if (typeof message.content === 'string') {
                        const replacedText = (message.content as string).replace(/^```html|```$/g, '');
                        navigator.clipboard.writeText(replacedText);
                        toast.success('Copied to clipboard');
                      }
                    }}>Copy Code</Button>
                  </div>
                  {viewMode === 'code' ? (
                    <ReactMarkdown components={{
                      pre: ({ node, ...props }) => (
                        <div className="overflow-auto w-full my-2 bg-black/10 p-2 rounded-lg">
                          <pre {...props} />
                        </div>
                      ),
                      code: ({ node, ...props }) => (
                        <code className="bg-black/10 rounded-lg p-1" {...props} />
                      )
                    }} className="text-sm overflow-hidden leading-7">
                      {message.content || ""}
                    </ReactMarkdown>
                  ) : (
                    <div className="my-4 border-[4px] border-black rounded-[20px] shadow-lg transform scale-[0.9] origin-top w-full h-[500px]">
                      <div dangerouslySetInnerHTML={{ __html: (message.content as string).replace(/^```html|```$/g, '') }} ></div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      {/* Image preview row */}
      <div className="p-4">
        {images.map((image, index) => (
          <div key={index} className="relative inline-block">
            <img
              src={URL.createObjectURL(image)}
              alt={`upload-preview ${index}`}
              className="h-16 w-16 object-cover rounded-lg mr-2"
            />
            <button
              onClick={() => removeImage(index)}
              className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 text-xs"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
      {/* Input area */}
      <div className="flex items-center justify-end space-x-2 p-4 bg-white">
        <label className="flex justify-center items-center p-2 rounded-full bg-gray-200 text-gray-500 w-10 h-10 cursor-pointer">
          <FontAwesomeIcon icon={faPaperclip} className="h-5 w-5" />
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageChange}
            className="hidden"
            disabled={isSending}
          />
        </label>
        <button
          className="flex justify-center items-center p-2 rounded-full bg-blue-600 text-white w-10 h-10"
          onClick={sendMessage}
          disabled={isSending}
        >
          {isSending ? (
            <FontAwesomeIcon icon={faSpinner} className="h-5 w-5 fa-spin" />
          ) : (
            <FontAwesomeIcon icon={faArrowRight} className="h-5 w-5" />
          )}
        </button>
      </div>
    </div>
  );
}

export default ChatContainer;