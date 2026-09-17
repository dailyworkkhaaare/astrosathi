import { expect, test } from "@playwright/test";

test("approved typography renders English, Devanagari and numeric specimens", async ({ page }) => {
  await page.goto("/");

  const specimens = await page.evaluate(async () => {
    const host = document.createElement("section");
    host.setAttribute("aria-label", "Typography validation specimens");
    host.style.cssText =
      "position:fixed;left:-10000px;top:0;width:320px;padding:16px;visibility:hidden";
    host.innerHTML = `
      <h2 data-specimen="english" lang="en" class="font-display text-title-lg">Your cosmic story</h2>
      <h2 data-specimen="hindi" lang="hi" class="font-display text-title-lg">आपकी जन्म कुंडली</h2>
      <h2 data-specimen="marathi" lang="mr" class="font-display text-title-lg">तुमची जन्मकुंडली</h2>
      <p data-specimen="numeric" class="font-numeric text-numeric-hero">12° 34′ 56″</p>
    `;
    document.body.append(host);

    await Promise.all([
      document.fonts.load('600 40px "Fraunces"', "Your cosmic story"),
      document.fonts.load('600 40px "Noto Serif Devanagari"', "आपकी जन्म कुंडली"),
      document.fonts.load('400 16px "Noto Sans Devanagari"', "मराठी हिंदी"),
      document.fonts.load('600 48px "DM Sans"', "12° 34′ 56″"),
    ]);
    await document.fonts.ready;

    const read = (name: string) => {
      const element = host.querySelector<HTMLElement>(`[data-specimen="${name}"]`)!;
      const style = getComputedStyle(element);
      return {
        family: style.fontFamily,
        letterSpacing: style.letterSpacing,
        lineHeight: style.lineHeight,
        textTransform: style.textTransform,
        numericVariant: style.fontVariantNumeric,
        overflow: element.scrollWidth > element.clientWidth,
      };
    };

    const result = {
      english: read("english"),
      hindi: read("hindi"),
      marathi: read("marathi"),
      numeric: read("numeric"),
      loaded: {
        fraunces: document.fonts.check('600 40px "Fraunces"', "Your cosmic story"),
        notoSerif: document.fonts.check('600 40px "Noto Serif Devanagari"', "आपकी जन्म कुंडली"),
        notoSans: document.fonts.check('400 16px "Noto Sans Devanagari"', "मराठी हिंदी"),
        dmSans: document.fonts.check('600 48px "DM Sans"', "12° 34′ 56″"),
      },
    };

    host.remove();
    return result;
  });

  expect(specimens.loaded).toEqual({
    fraunces: true,
    notoSerif: true,
    notoSans: true,
    dmSans: true,
  });
  expect(specimens.english.family).toContain("Fraunces");
  expect(specimens.hindi.family).toContain("Noto Serif Devanagari");
  expect(specimens.marathi.family).toContain("Noto Serif Devanagari");
  expect(specimens.hindi.letterSpacing).toBe("normal");
  expect(specimens.marathi.letterSpacing).toBe("normal");
  expect(specimens.hindi.textTransform).toBe("none");
  expect(specimens.marathi.textTransform).toBe("none");
  expect(specimens.numeric.family).toContain("DM Sans");
  expect(specimens.numeric.numericVariant).toContain("tabular-nums");
  expect([
    specimens.english.overflow,
    specimens.hindi.overflow,
    specimens.marathi.overflow,
    specimens.numeric.overflow,
  ]).toEqual([false, false, false, false]);
});
