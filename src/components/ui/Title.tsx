import { Flex, Box, Title, Text } from "@mantine/core";
import getConfig from "next/config";
const { publicRuntimeConfig } = getConfig();
const { buildVersion } = publicRuntimeConfig;

export default function ComponentTitle() {
  return (
    <Box py={"md"}>
      <Flex gap={"sm"} align={"flex-end"} direction={"row"}>
        <Title>YouTube Trimmer</Title>

        <Text c={"dimmed"} size={"xs"}>(v{buildVersion})</Text>
      </Flex>
    </Box>
  );
};