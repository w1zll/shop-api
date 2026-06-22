import { validateEnvironment } from "./environment";

describe("validateEnvironment", () => {
  it("parses comma-separated frontend origins", () => {
    const config = validateEnvironment({
      FRONTEND_ORIGINS:
        "https://shop.example.com, https://shop-catalog-git-dev.example.com ,",
    });

    expect(config.FRONTEND_ORIGINS).toEqual([
      "https://shop.example.com",
      "https://shop-catalog-git-dev.example.com",
    ]);
  });

  it("keeps the default primary frontend origin", () => {
    expect(validateEnvironment({}).FRONTEND_ORIGIN).toBe("http://localhost:3000");
  });
});
