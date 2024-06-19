import Link from "next/link";
import { Anchor, Flex, Text, Button, px, Image, Popover } from "@mantine/core";

const parties = [
  { icon: "https://cdn.simpleicons.org/wise", brandName: "Wise (Copy Email)", text: "personal@13373333.one" },
  { icon: "https://cdn.simpleicons.org/kofi", brandName: "Ko-Fi", text: "https://ko-fi.com/goodfaith" },
  { icon: "https://saweria.co/favicon.ico", brandName: "Saweria (Indonesia)", text: "https://saweria.co/goodfaith" }
];

export default function Footer() {
  return (
    <Flex direction={"row"} gap={"md"} py={"xl"} mt={"xl"} px={"sm"} align={"center"} justify={"center"}>
      <Text c={"dimmed"} size={"sm"}>
        <Flex direction={"row"} align={"center"} gap={px(4)} wrap={"wrap"}>
          This project is <Anchor target={"_blank"} href={"https://github.com/ray-1337/youtube-video-trimmer"}>open-source.</Anchor> Made by <Anchor target={"_blank"} href={"https://13373333.one"}>ray.</Anchor>

          <Popover position="bottom" withArrow shadow="md">
            <Popover.Target>
              <Flex wrap={"wrap"}>
                A small <Text c={"blue"} style={{ cursor: "pointer" }} mx={px(3)}>donation</Text> is appreciated. ❤️
              </Flex>
            </Popover.Target>
            <Popover.Dropdown>
              <Flex gap={"md"} direction={"column"}>
                {
                  parties.map((party, index) => {
                    return (
                      <Button justify={"flex-start"} key={index} target={party.text.startsWith("https") ? "_blank" : undefined} onClick={() => !party.text.startsWith("https") && navigator.clipboard.writeText(party.text)} variant={"subtle"} href={party.text.startsWith("https") ? party.text : ""} component={party.text.startsWith("https") ? Link : undefined} leftSection={<Image w={16} h={16} src={party.icon} loading={"lazy"} />}>
                        {party.brandName}
                      </Button>
                    )
                  })
                }
              </Flex>
            </Popover.Dropdown>
          </Popover>
        </Flex>
      </Text>
    </Flex>
  );
};