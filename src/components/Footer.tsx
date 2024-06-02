import { Anchor, Flex, Text } from "@mantine/core";

export default function Footer() {
  return (
    <Flex direction={"row"} gap={"md"} py={"xl"} mt={"xl"} px={"sm"} align={"center"} justify={"center"}>
      <Text c={"dimmed"} size={"sm"}>
        This project is <Anchor target={"_blank"} href={"https://github.com/ray-1337/youtube-trimmer-ffmpeg"}>open-source.</Anchor> Made by <Anchor target={"_blank"} href={"https://github.com/ray-1337/"}>ray</Anchor>.
      </Text>
    </Flex>
  );
};