# Spark Browser Extension

The Official Browser Extension for Spark.

## Features

- Add and organize new links to Spark with a single click.
- Upload screenshots of the current page to Spark.
- Save all tabs in the current window to Spark.
- Sign in using API key or Username/Password.

![Image](/assets/spark-extension.png)

## Installation

### Build From Source

#### Requirements

- LTS NodeJS 18.x.x
- NPM Version 9.x.x
- Bash
- Git

#### Step 1: Clone this repo

Clone this repository by running the following in your terminal:

```bash
git clone https://github.com/spark-archive/spark-extension.git
```

#### Step 2: Build

Head to the generated folder:

```bash
cd spark-extension
```

And run:

```bash
chmod +x ./build.sh && ./build.sh
```

After the above command, use the `/dist` folder as an unpacked extension in your browser.
