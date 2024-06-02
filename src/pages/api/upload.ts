import type { NextApiRequest, NextApiResponse } from 'next';

const isDev = process.env.NODE_ENV === "development";

const scheme = isDev ? "http" : "https";
const endpoint = isDev ? "localhost:3003" : process.env.API_ENDPOINT;

export const config = {
  maxDuration: 60
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req?.method !== "POST") {
      return res.status(400).send("invalid request method.");
    };

    const request = await fetch(`${scheme}://${endpoint}/trim`, {
      method: "POST",
    
      headers: {
        "content-type": "application/json",
        "authorization": String(process.env.SERVER_AUTH)
      },

      body: JSON.stringify(req.body)
    });

    const text = await request.text();

    return res.status(request.status).setHeader("content-type", "text/plain").send(text);
  } catch (error) {
    console.error(error);

    return res.status(500).send("something went wrong from the backend.");
  };
};