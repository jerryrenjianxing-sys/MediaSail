# MediaSail identity

`MediaSail-selected-logo.png` is the user-selected purple M/sail concept with wordmark.
`MediaSail-app-icon.png` is the transparent application-icon export made with the
built-in image generation tool. `scripts/prepare.py assets` copies it into the app,
exports Windows ICO sizes and stages the frontend icon. No runtime image service is used.

Final edit prompt (built-in image generation, not API/CLI):

> Use case: background-extraction. Asset type: Windows desktop application icon.
> Input image is the exact approved MediaSail logo, an EDIT TARGET, not loose inspiration.
> Extract ONLY the upper purple rounded square icon, remove the surrounding white
> background and the entire MediaSail wordmark below. Preserve the exact existing
> white M/sail shape, light purple top-right triangular fold, purple color and
> rounded-square proportions. Do not redesign, add objects, add shadows, or add text.
> Square image, the rounded square fills approximately 94% of the canvas, centered
> with small equal transparent margins. True transparent alpha outside the rounded
> square; the white M and sail inside remain opaque white. Crisp high-resolution edges.
