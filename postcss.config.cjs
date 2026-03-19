module.exports = {
    plugins: {
        tailwindcss: {},
        autoprefixer: {},
        // Convert rem to px for Shadow DOM compatibility
        // Sites like YouTube use font-size: 10px on html, breaking Tailwind's rem units
        'postcss-rem-to-pixel': {
            rootValue: 16,
            propList: ['*'],
            replace: true,
            mediaQuery: true,
            minPixelValue: 0
        }
    }
}