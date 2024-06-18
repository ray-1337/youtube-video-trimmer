import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { Box, Flex, TextInput, NumberInput, Title, Button, Paper, Anchor, Alert } from "@mantine/core";
import { validateURL, getURLVideoID } from "ytdl-core";

const Footer = dynamic(() => import("@/components/ui/Footer"), { ssr: false });

import style from "@/styles/index.module.css";

const [minDuration, maxDuration] = [0, 43200];

export default function Homepage() {
  const [urlInput, setUrlInput] = useState<string | null>(null);
  const [currentYouTubeID, setCurrentYouTubeID] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setLoadingState] = useState<boolean>(false);
  const [finalJobId, setFinalJobId] = useState<string | null>(null);

  // im so bad at this
  const [fromSecond, setFromSecond] = useState<number>(0);
  const [toSecond, setToSecond] = useState<number>(0);

  const fromRef = useRef<HTMLInputElement | null>(null);
  const toRef = useRef<HTMLInputElement | null>(null);

  // register youtube watch ID
  useEffect(() => {
    if (urlInput !== null) {
      try {
        setErrorMessage(null);

        const ytID = getURLVideoID(urlInput);
        
        if (typeof ytID === "string") {
          setCurrentYouTubeID(ytID);
        };
      } catch {

      };
    };
  }, [urlInput]);

  // set to max if the second is over the limit
  useEffect(() => {
    if (fromSecond > 0 && toSecond < fromSecond) {
      setToSecond((fromSecond + 1));
    };
  }, [fromSecond, toSecond]);

  const startRequest = async () => {
    setFinalJobId(null);
    setErrorMessage(null);

    setLoadingState(true);

    try {
      const request = await fetch("/api/upload", {
        mode: "cors",

        method: "POST",

        body: JSON.stringify({
          url: `https://youtu.be/${currentYouTubeID}`,
          duration: [fromSecond, toSecond]
        }),

        headers: {
          "content-type": "application/json"
        }
      });

      setLoadingState(false);

      const text = await request.text();

      if (request.status !== 200 && request.status !== 201) {
        if (request.status === 504) {
          return setErrorMessage(`[504] Gateway Timeout`);
        };

        return setErrorMessage(`[${request.status}] ${text}`);
      };

      return setFinalJobId(text);
    } catch (error) {
      setLoadingState(false);
      console.error(error);
    };

    return;
  };

  return (
    <section className={style.container}>
      <section className={style.insider}>
        <Flex direction={"column"} gap={"md"}>
          <Box py={"md"}>
            <Title>YouTube Trimmer</Title>
          </Box>

          <Flex py={"md"} gap={"xl"} direction={"column"}>
            {/* error box */}
            {
              (errorMessage !== null) && (
                <Alert title={"Error"} color={"red"} variant={"filled"}>
                  { errorMessage }
                </Alert>
              )
            }

            <TextInput disabled={isLoading} label={"YouTube URL"} placeholder={"https://youtu.be/dQw4w9WgXcQ"} maxLength={128} onChange={(event) => setUrlInput(event.currentTarget.value)} error={urlInput !== null && !validateURL(urlInput) && "Invalid YouTube URL"}/>

            {/* time input */}
            <Flex gap={"md"} justify={"space-between"} align={"center"}>
              <NumberInput disabled={isLoading} ref={fromRef} label={"Start (seconds)"} hideControls value={fromSecond} min={minDuration} max={maxDuration} placeholder={"0"} onChange={(value) => setFromSecond(+value || 0)}/>

              <NumberInput disabled={isLoading} ref={toRef} label={"End (seconds)"} hideControls value={toSecond} min={(fromSecond + 1) || 0} max={maxDuration} placeholder={"43200"} onBlur={(event) => setToSecond(+event.currentTarget.value || 0)}/>
            </Flex>

            {/* trim button */}
            <Button onClick={startRequest} disabled={typeof fromSecond !== "number" || typeof toSecond !== "number" || (fromSecond <= 0 && toSecond <= 0)} loading={isLoading}>
              Trim
            </Button>

            {/* finalized url */}
            {
              (finalJobId !== null) && (
                <Paper shadow={"sm"} p={"md"} bd={"1px dashed black"}>
                  <Flex justify={"flex-start"} align={"center"} gap={"xl"}>
                    <Anchor href={`/status/${finalJobId}`} target="_blank">
                      Progress Status
                    </Anchor>
                  </Flex>
                </Paper>
              )
            }
          </Flex>

          {
            currentYouTubeID !== null && (
              <Box py={"md"} className={style["embed-container"]}>
                <iframe src={`https://www.youtube-nocookie.com/embed/${currentYouTubeID}?controls=1&rel=0&start=${fromSecond}${toSecond >= 1 ? `&end=${toSecond}` : ""}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" />
              </Box>
            )
          }
        </Flex>

        <Footer />
      </section>
    </section>
  );
};