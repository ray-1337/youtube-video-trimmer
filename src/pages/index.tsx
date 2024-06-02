import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { Box, Flex, TextInput, NumberInput, Tooltip, Title, Button, Paper, Anchor, Alert, Text } from "@mantine/core";
import { validateURL, getURLVideoID } from "ytdl-core";

const Footer = dynamic(() => import("@/components/Footer"), { ssr: false });

import style from "@/styles/index.module.css";

const [minDuration, maxDuration] = [0, 43200];

export default function Homepage() {
  const [urlInput, setUrlInput] = useState<string | null>(null);
  const [currentYouTubeID, setCurrentYouTubeID] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setLoadingState] = useState<boolean>(false);
  const [finalURL, setFinalURL] = useState<string | null>(null);
  const [perfTime, setPerfTime] = useState<number | null>(null);

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
    setFinalURL(null);
    setPerfTime(null);
    setErrorMessage(null);

    setLoadingState(true);

    try {
      const start = Date.now();

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

      setPerfTime(Date.now() - start);

      if (request.status !== 200 && request.status !== 201) {
        return setErrorMessage(`[${request.status}] ${text}`);
      };

      return setFinalURL(text);
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
                <Alert title={"Error"} color={"red"}>
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
              (finalURL !== null) && (
                <Paper shadow={"sm"} p={"md"} bd={"1px dashed black"}>
                  <Flex justify={"space-between"} align={"center"} gap={"xl"}>
                    <Anchor href={finalURL} target="_blank">
                      Link Download
                    </Anchor>

                    {
                      (perfTime !== null) && (
                        <Tooltip label={"Time processing"} withArrow>
                          <Text size={"xs"} c={"dimmed"} style={{cursor: "default"}}>
                            {perfTime.toLocaleString()} ms
                          </Text>
                        </Tooltip>
                      )
                    }
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