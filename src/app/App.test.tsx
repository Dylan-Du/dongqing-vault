import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the local collection shell", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "网站收藏库" })).toBeVisible();
  });
});
