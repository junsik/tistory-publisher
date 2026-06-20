import { createApp } from "windforce-client";
import { publish } from "./actions/publish";
import { list } from "./actions/list";

export const main = createApp({
  actions: {
    "tistory.publish": publish,
    "tistory.list": list,
  },
});
