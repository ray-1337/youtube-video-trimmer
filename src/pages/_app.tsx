import type { AppProps } from "next/app";
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';
import { MantineProvider } from "@mantine/core";

import "@mantine/core/styles.css";

const reCAPTCHAsiteKey: string = "6LdCZvwpAAAAACmEC5HLSOqiBFfwFvZQ_-2KIE-2";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <MantineProvider>
      <GoogleReCaptchaProvider reCaptchaKey={reCAPTCHAsiteKey}>
        <Component {...pageProps} />
      </GoogleReCaptchaProvider>
    </MantineProvider>
  );
};