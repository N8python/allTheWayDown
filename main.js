import { TickerGenerator } from './ticker-generator.js';
let modelWorker;
let isGenerating = false;
let usernames;
const generator = new TickerGenerator();
async function initializeSystem() {
    // Load usernames first
    usernames = (await (await fetch('unique_usernames.txt')).text()
            .then(text => text.split('\n')))
        .map(x => x.trim().replace("@", ""));

    // Initialize worker
    modelWorker = new Worker(new URL('./model-worker.js',
        import.meta.url), { type: 'module' });

    modelWorker.onmessage = handleWorkerMessage;
    modelWorker.onerror = (error) => {
        console.error('Worker error:', error);
        isGenerating = false;
    };

    // Send initialization message to worker
    modelWorker.postMessage({ type: 'init' });
}

function handleWorkerMessage(e) {
    const { type, data, error } = e.data;

    switch (type) {
        case 'initialized':
            console.log('Model initialized in worker');
            // Generate initial set of tweets
            modelWorker.postMessage({
                type: 'generate-in-batch',
                data: { count: 20, batchSize: 2 }
            });
            break;

        case 'generation-complete':
            handleGeneratedTweets(data);
            break;

        case 'error':
            console.error('Generation error:', error);
            isGenerating = false;
            document.getElementById('loading').style.display = 'none';
            break;
    }
}

async function generateTweets(count = 3) {
    if (isGenerating) return;
    isGenerating = true;

    const loadingIndicator = document.getElementById('loading');
    loadingIndicator.style.display = 'block';

    modelWorker.postMessage({
        type: 'generate',
        data: { count }
    });
}

function handleGeneratedTweets(data) {
    const { texts, time, tokens } = data;
    const tweetsContainer = document.getElementById('tweets-container');
    const availableTickers = Array.from(tickerManager.tickers.keys());
    // Add 3 random tickers to the available tickers
    for (let i = 0; i < 3; i++) {
        availableTickers.push(generator.generateTicker(3).toUpperCase());
    }
    // Process and display tweets
    texts.forEach(tweet => {
        let processedTweet = tweet;

        // Process usernames
        const matches = processedTweet.match(/@[\w_]+/g);
        if (matches) {
            matches.forEach(match => {
                const username = usernames[Math.floor(Math.random() * usernames.length)];
                processedTweet = processedTweet.replace(match, "@" + username);
            });
        }

        // Process tickers
        const tickers = processedTweet.match(/\$[A-Za-z]+/g);
        const alreadyConverted = {};
        if (tickers) {
            tickers.forEach(ticker => {
                const isAllCaps = ticker.slice(1).split("").every(c => c === c.toUpperCase());
                let newTicker = availableTickers[Math.floor(Math.random() * availableTickers.length)];
                if (!isAllCaps) {
                    newTicker = newTicker.toLowerCase();
                }
                if (alreadyConverted[ticker.toLowerCase()]) {
                    newTicker = alreadyConverted[ticker.toLowerCase()];
                }
                alreadyConverted[ticker.toLowerCase()] = newTicker;
                processedTweet = processedTweet.replace(ticker, "$" + newTicker);
            });
        }

        // Process crypto hashtags
        const hashtags = processedTweet.match(/#[A-Za-z]+/g);
        if (hashtags) {
            hashtags.forEach(hashtag => {
                let newHashtag = availableTickers[Math.floor(Math.random() * availableTickers.length)];
                if (alreadyConverted[hashtag.toLowerCase()]) {
                    newHashtag = alreadyConverted[hashtag.toLowerCase()];
                }
                alreadyConverted[hashtag.toLowerCase()] = newHashtag;
                processedTweet = processedTweet.replace(hashtag, "#" + newHashtag);
            });
        }

        // Process bitcoin words
        const bitcoinWords = ["btc", "bitcoin", "Bitcoin", "BTC", "eth", "ethereum", "Ethereum", "ETH",
            "doge", "dogecoin", "Dogecoin", "DOGE", "ETH/BTC", "BTC/ETH", "ETH/USD",
            "USD/ETH", "BTC/USD", "USD/BTC", "DOGE/USD", "USD/DOGE", "DOGE/BTC", "BTC/DOGE"
        ];

        const bitcoinMatches = processedTweet.match(new RegExp("(" + bitcoinWords.join("|") + ")", "g"));
        if (bitcoinMatches) {
            bitcoinMatches.forEach(bitcoinMatch => {
                let newBitcoinWord = availableTickers[Math.floor(Math.random() * availableTickers.length)];
                if (alreadyConverted[bitcoinMatch.toLowerCase()]) {
                    newBitcoinWord = alreadyConverted[bitcoinMatch.toLowerCase()];
                }
                alreadyConverted[bitcoinMatch.toLowerCase()] = newBitcoinWord;
                processedTweet = processedTweet.replace(bitcoinMatch, newBitcoinWord);
            });
        }

        // HTML entity replacements
        processedTweet = processedTweet.replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/<\|pad\|>/g, "");

        // Process money amounts
        const moneyMatches = processedTweet.match(/\$[\d,]+(?:\.\d+)?/g);
        const scaleDownFactor = 10 ** (0.5 + 1.5 * Math.random());
        if (moneyMatches) {
            moneyMatches.forEach(moneyMatch => {
                const moneyAmount = parseFloat(moneyMatch.slice(1));
                const isDecimal = moneyMatch.includes(".");
                let newMoneyAmount = Math.round(moneyAmount) / scaleDownFactor;
                if (!isDecimal) {
                    newMoneyAmount = Math.round(newMoneyAmount);
                }
                if (Number.isNaN(newMoneyAmount)) {
                    newMoneyAmount = moneyAmount;
                }
                processedTweet = processedTweet.replace(moneyMatch, "$" + newMoneyAmount.toFixed(isDecimal ? 2 : 0));
            });
        }

        // Process k-notation
        const kMatches = processedTweet.match(/\$?[\d]+[kK]/g);
        if (kMatches) {
            kMatches.forEach(kMatch => {
                const number = parseInt(kMatch.slice(1, -1));
                if (!Number.isNaN(number)) {
                    processedTweet = processedTweet.replace(kMatch, "$" + number);
                }
            });
        }

        // Replace Twitter-related words
        processedTweet = processedTweet.replace(/twitter/g, "turtle").replace(/tweet/g, "shell");

        // Create and append tweet element
        const tweetDiv = document.createElement('div');
        tweetDiv.className = 'tweet';
        tweetDiv.style.backgroundColor = `hsl(${Math.random() * 360}, 100%, 90%)`;
        tweetDiv.style.borderLeft = `4px solid hsl(${Math.random() * 360}, 100%, 50%)`;

        const username = usernames[Math.floor(Math.random() * usernames.length)];
        const usernameSpan = document.createElement('span');
        usernameSpan.className = 'username';
        usernameSpan.innerHTML = "<em>@" + username + "</em>";
        usernameSpan.style.color = `rgb(128, 128, 128)`;

        const textDiv = document.createElement('div');
        textDiv.className = 'text';
        textDiv.textContent = processedTweet;

        tweetDiv.append(usernameSpan, textDiv);
        tweetDiv.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: 500,
            easing: 'ease-in'
        });

        tweetsContainer.appendChild(tweetDiv);
    });

    isGenerating = false;
    document.getElementById('loading').style.display = 'none';
}

async function handleScroll() {
    const tweetsContainer = document.getElementById('tweets-container');
    if (tweetsContainer.scrollTop + tweetsContainer.clientHeight >= tweetsContainer.scrollHeight - 100 && !isGenerating) {
        generateTweets(1);
    }
}
class MemeTickerManager {
    constructor() {
        this.tickers = new Map();
        this.generator = new TickerGenerator();
        this.historyLength = 20;
        this.tickerCount = 10;
        this.portfolio = {
            cash: 10000, // $100.00 in cents
            holdings: new Map()
        };
        this.MODEL_PARAMS = {
            baseVolatility: 0.02,
            momentumDecay: 0.7,
            meanReversionStrength: 0.1,
            regimes: {
                accumulation: {
                    volatilityRange: [0.005, 0.01],
                    directionalBias: 0.2,
                    durationRange: [10, 30],
                    transitionProbs: {
                        viral: 0.4,
                        dump: 0.1,
                        accumulation: 0.5
                    }
                },
                viral: {
                    volatilityRange: [0.05, 0.2],
                    directionalBias: 0.8,
                    durationRange: [3, 8],
                    transitionProbs: {
                        accumulation: 0.2,
                        dump: 0.7,
                        viral: 0.1
                    }
                },
                dump: {
                    volatilityRange: [0.05, 0.15],
                    directionalBias: -0.7,
                    durationRange: [3, 8],
                    transitionProbs: {
                        accumulation: 0.6,
                        viral: 0.1,
                        dump: 0.3
                    }
                }
            },
            sentiment: {
                baseRange: [0.5, 3.0],
                meanReversionRate: 0.1,
                memory: 0.8
            },
            whale: {
                probability: 0.05,
                impactRange: [-0.3, 0.4],
                viralMultiplier: 2.0
            },
            deathSpiral: {
                probability: 0.001,
                decayRate: 0.05,
                dumpThreshold: 5
            }
        };
        this.REPLACEMENT_THRESHOLDS = {
            minPrice: 0.00001, // Replace coins that fall below this price
            maxDeathDuration: 50, // Replace coins that have been in death spiral for this many ticks
            deathSpiralCounter: new Map() // Track how long coins have been in death spiral
        };
        this.initializeTickers();
    }

    initializeTickers() {
        const container = document.getElementById('ticker-container');
        container.innerHTML = '';

        for (let i = 0; i < this.tickerCount; i++) {
            const ticker = this.generator.generateTicker(3, 4).toUpperCase();
            const initialPrice = Math.random() * 100 + 0.01;
            const history = this.generateHistoricalPrices(initialPrice, this.historyLength);
            const tickerState = this.initializeTickerState();
            tickerState.ticker = ticker;
            this.tickers.set(ticker, {
                price: history[history.length - 1],
                prevPrice: history[history.length - 2],
                history: history,
                element: this.createTickerElement(ticker, history[history.length - 1], history),
                state: tickerState,
                momentum: 0
            });
        }

        this.startUpdates();
    }
    createTickerElement(symbol, price, history) {
        const ticker = document.createElement('div');
        ticker.className = 'ticker';

        // Create the header section
        const header = document.createElement('div');
        header.className = 'ticker-header';
        header.innerHTML = `
            <div>
                <span class="ticker-symbol">$${symbol}</span>
                <span class="ticker-change"></span>
            </div>
            <span class="ticker-price">${price.toFixed(4)}</span>
        `;

        // Create trading controls
        const controls = document.createElement('div');
        controls.className = 'trading-controls';
        controls.innerHTML = `
            <input type="number" min="0" step="1" placeholder="Amount" class="trade-amount">
            <button class="buy-btn">Buy</button>
            <button class="sell-btn">Sell</button>
        `;

        // Add event listeners for trading
        const buyBtn = controls.querySelector('.buy-btn');
        const sellBtn = controls.querySelector('.sell-btn');
        const amountInput = controls.querySelector('.trade-amount');

        buyBtn.addEventListener('click', () => this.executeTrade(symbol, Number(amountInput.value), true));
        sellBtn.addEventListener('click', () => this.executeTrade(symbol, Number(amountInput.value), false));

        // Create and set up the canvas
        const canvas = document.createElement('canvas');
        canvas.className = 'mini-chart';

        // Add elements to the ticker
        ticker.appendChild(header);
        ticker.appendChild(controls);
        ticker.appendChild(canvas);

        // Add to container
        document.getElementById('ticker-container').appendChild(ticker);

        // Update canvas resolution after it's in the DOM
        this.updateCanvasResolution(canvas);

        // Initial chart render
        const priceChange = history[history.length - 1] - history[history.length - 2];
        this.drawChart(canvas, history, priceChange >= 0);

        return ticker;
    }
    initializeTickerState() {
        return {
            regime: 'accumulation',
            regimeDuration: 0,
            regimeTarget: this.getRandomDuration('accumulation'),
            sentiment: 1.0,
            isDeathSpiral: false,
            consecutiveDumps: 0,
            lastChange: 0
        };
    }

    getRandomDuration(regime) {
        const [min, max] = this.MODEL_PARAMS.regimes[regime].durationRange;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    updateRegime(state) {
        state.regimeDuration++;

        if (state.regimeDuration >= state.regimeTarget) {
            const rand = Math.random();
            const probs = {...this.MODEL_PARAMS.regimes[state.regime].transitionProbs };
            // Get price of coin
            probs["dump"] += 0.1 * Math.log(this.tickers.get(state.ticker).price);
            // Renormalize probabilities
            const total = Object.values(probs).reduce((a, b) => a + b, 0);
            for (const key in probs) {
                probs[key] /= total;
            }

            let newRegime = state.regime;
            let cumProb = 0;

            for (const [regime, prob] of Object.entries(probs)) {
                cumProb += prob;
                if (rand <= cumProb) {
                    newRegime = regime;
                    break;
                }
            }
            if (newRegime !== state.regime) {
                state.regime = newRegime;
                state.regimeDuration = 0;
                state.regimeTarget = this.getRandomDuration(newRegime);
            }
        }
    }

    updateSentiment(state, priceChange) {
        const { meanReversionRate, memory, baseRange } = this.MODEL_PARAMS.sentiment;

        // Update sentiment based on price change
        const sentimentImpact = Math.abs(priceChange) * (priceChange > 0 ? 1 : -0.5);
        state.sentiment = state.sentiment * memory +
            (1 + sentimentImpact) * (1 - memory);

        // Apply mean reversion
        state.sentiment += (1 - state.sentiment) * meanReversionRate;

        // Clamp to range
        state.sentiment = Math.max(baseRange[0],
            Math.min(baseRange[1], state.sentiment));
    }

    checkDeathSpiral(state) {
        if (state.isDeathSpiral) return true;

        if (state.regime === 'dump') {
            state.consecutiveDumps++;
        } else {
            state.consecutiveDumps = 0;
        }

        if (state.consecutiveDumps >= this.MODEL_PARAMS.deathSpiral.dumpThreshold &&
            Math.random() < this.MODEL_PARAMS.deathSpiral.probability) {
            state.isDeathSpiral = true;
            return true;
        }

        return false;
    }

    calculatePriceChange(ticker) {
        const state = ticker.state;
        const regime = this.MODEL_PARAMS.regimes[state.regime];
        // Base movement
        const volatility = regime.volatilityRange[0] +
            Math.random() * (regime.volatilityRange[1] - regime.volatilityRange[0]);
        let change = (Math.random() * 2 - 1 + regime.directionalBias) * volatility;

        // Apply sentiment multiplier
        change *= state.sentiment;

        // Apply momentum
        ticker.momentum = ticker.momentum * this.MODEL_PARAMS.momentumDecay + change;
        change += ticker.momentum;

        // Check for whale movement
        if (Math.random() < this.MODEL_PARAMS.whale.probability *
            (state.regime === 'viral' ? this.MODEL_PARAMS.whale.viralMultiplier : 1)) {
            const whaleImpact = this.MODEL_PARAMS.whale.impactRange[0] +
                Math.random() * (this.MODEL_PARAMS.whale.impactRange[1] -
                    this.MODEL_PARAMS.whale.impactRange[0]);
            change += whaleImpact;
        }

        // Apply death spiral if active
        if (state.isDeathSpiral) {
            change = -Math.abs(change) - this.MODEL_PARAMS.deathSpiral.decayRate;
        }

        return change;
    }
    checkForReplacement(symbol, ticker) {
        // Check if ticker needs replacement based on price or death spiral duration
        if (ticker.price <= this.REPLACEMENT_THRESHOLDS.minPrice) {
            this.replaceTicker(symbol);
            return true;
        }

        if (ticker.state.isDeathSpiral) {
            // Initialize or increment death spiral counter
            const currentCount = this.REPLACEMENT_THRESHOLDS.deathSpiralCounter.get(symbol) || 0;
            this.REPLACEMENT_THRESHOLDS.deathSpiralCounter.set(symbol, currentCount + 1);

            if (currentCount >= this.REPLACEMENT_THRESHOLDS.maxDeathDuration) {
                this.replaceTicker(symbol);
                return true;
            }
        } else {
            // Reset counter if not in death spiral
            this.REPLACEMENT_THRESHOLDS.deathSpiralCounter.delete(symbol);
        }

        return false;
    }

    replaceTicker(symbol) {
        // Remove old ticker element from DOM
        const oldTicker = this.tickers.get(symbol);
        if (oldTicker && oldTicker.element) {
            oldTicker.element.remove();
        }

        // Generate new ticker
        const newSymbol = this.generator.generateTicker(3, 4).toUpperCase();
        const initialPrice = Math.random() * 100 + 0.01;
        const history = this.generateHistoricalPrices(initialPrice, this.historyLength);
        const tickerState = this.initializeTickerState();
        tickerState.ticker = newSymbol;

        // Create new ticker data
        const newTickerData = {
            price: history[history.length - 1],
            prevPrice: history[history.length - 2],
            history: history,
            element: this.createTickerElement(newSymbol, history[history.length - 1], history),
            state: tickerState,
            momentum: 0
        };

        // Remove old ticker and add new one
        this.tickers.delete(symbol);
        this.tickers.set(newSymbol, newTickerData);

        // Add animation class for smooth entrance
        newTickerData.element.classList.add('ticker-new');
        setTimeout(() => {
            newTickerData.element.classList.remove('ticker-new');
        }, 1000);

        console.log(`Replaced ${symbol} with ${newSymbol}`);
    }

    executeTrade(symbol, amount, isBuy) {
        if (!amount || amount <= 0) {
            alert('Please enter a valid amount');
            return;
        }

        const ticker = this.tickers.get(symbol);
        if (!ticker) return;

        const totalCost = (ticker.price * amount);

        if (isBuy) {
            if (totalCost > this.portfolio.cash) {
                alert('Insufficient funds!');
                return;
            }
            this.portfolio.cash -= totalCost;
            const currentHolding = this.portfolio.holdings.get(symbol) || 0;
            this.portfolio.holdings.set(symbol, currentHolding + amount);
        } else {
            const currentHolding = this.portfolio.holdings.get(symbol) || 0;
            if (amount > currentHolding) {
                alert('Insufficient coins!');
                return;
            }
            this.portfolio.cash += totalCost;
            this.portfolio.holdings.set(symbol, currentHolding - amount);
            if (currentHolding - amount === 0) {
                this.portfolio.holdings.delete(symbol);
            }
        }

        this.updatePortfolioDisplay();
    }

    updatePortfolioDisplay() {
        // Update cash balance
        document.querySelector('.balance-amount').textContent = `$${(this.portfolio.cash / 100).toFixed(2)}`;

        // Update holdings
        const holdingsContainer = document.querySelector('.holdings');
        holdingsContainer.innerHTML = '<h3>Your Memecoins</h3>';

        for (const [symbol, amount] of this.portfolio.holdings) {
            const ticker = this.tickers.get(symbol);
            if (!ticker) continue;

            const value = (ticker.price * amount);
            const percentChange = ((ticker.price - ticker.prevPrice) / ticker.prevPrice) * 100;
            const changeClass = percentChange >= 0 ? 'positive' : 'negative';

            const holdingDiv = document.createElement('div');
            holdingDiv.className = 'holding-item';
            holdingDiv.innerHTML = `
                <span class="coin-name">$${symbol}</span>
                <span class="coin-amount">${amount.toFixed(0)}</span>
                <span class="coin-value ${changeClass}">${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(1)}%</span>
            `;
            holdingsContainer.appendChild(holdingDiv);
        }
    }

    updateTicker(symbol, forceUpdate = false) {
        const ticker = this.tickers.get(symbol);
        if (!ticker || this.checkForReplacement(symbol, ticker)) return;

        // Update state
        this.updateRegime(ticker.state);
        const priceChange = this.calculatePriceChange(ticker);
        this.updateSentiment(ticker.state, priceChange);
        this.checkDeathSpiral(ticker.state);

        // Calculate new price
        const newPrice = ticker.price * (1 + priceChange);

        const percentChange = ((newPrice - ticker.prevPrice) / ticker.prevPrice) * 100;

        ticker.prevPrice = ticker.price;
        ticker.price = Math.max(0.000001, newPrice); // Prevent zero/negative prices
        ticker.history.push(ticker.price);
        ticker.history.shift();

        // Update UI
        const priceElement = ticker.element.querySelector('.ticker-price');
        const changeElement = ticker.element.querySelector('.ticker-change');
        const tickerElement = ticker.element.querySelector('.ticker-symbol');

        // Update portfolio display after price changes
        this.updatePortfolioDisplay();

        // Add regime indicator to ticker symbol
        const regimeIndicators = {
            accumulation: '🔄',
            viral: '🚀',
            dump: '📉'
        };
        const indicator = ticker.state.isDeathSpiral ? '💀' : regimeIndicators[ticker.state.regime];
        tickerElement.textContent = `$${symbol}`;

        priceElement.textContent = `$${ticker.price.toFixed(2)}`;
        changeElement.textContent = `${percentChange >= 0 ? '▲' : '▼'} ${Math.abs(percentChange).toFixed(2)}%`;

        const changeClass = percentChange >= 0 ? 'price-up' : 'price-down';
        priceElement.className = `ticker-price ${changeClass}`;
        changeElement.className = `ticker-change ${changeClass}`;

        // Update chart
        const canvas = ticker.element.querySelector('canvas');
        this.drawChart(canvas, ticker.history, percentChange >= 0);
    }

    startUpdates() {
        setInterval(() => {
            for (const [symbol, ticker] of this.tickers) {
                this.updateTicker(symbol);
            }
        }, 333);
    }


    updateCanvasResolution(canvas) {
        // Get the computed size of the canvas
        const rect = canvas.getBoundingClientRect();

        // Set the canvas internal dimensions to match its CSS dimensions
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
    }

    drawChart(canvas, history, isUp) {
        // Update canvas resolution before drawing
        this.updateCanvasResolution(canvas);

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // Clear the canvas
        ctx.clearRect(0, 0, width, height);

        // Calculate min and max for scaling
        const max = Math.max(...history);
        const min = Math.min(...history);
        const range = max - min || 1; // Prevent division by zero

        // Set up styling
        ctx.strokeStyle = isUp ? '#22c55e' : '#ef4444'; // green for up, red for down
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Begin drawing
        ctx.beginPath();

        // Plot points
        history.forEach((price, i) => {
            const x = (i / (history.length - 1)) * (width - 5);
            const y = height - ((price - min) / range * (height - 10) + 5);

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        // Render the line
        ctx.stroke();
    }
    generateHistoricalPrices(initialPrice, length) {
        const history = [initialPrice];
        let currentPrice = initialPrice;

        // Generate more realistic price movements using random walks with momentum
        let momentum = 0;
        const momentumFactor = 0.7; // How much previous price movement affects next move
        const volatility = 0.03; // Base volatility for price movements

        for (let i = 1; i < length; i++) {
            // Combine momentum with new random movement
            const randomChange = (Math.random() - 0.5) * volatility;
            momentum = momentum * momentumFactor + randomChange;

            // Apply the change to current price
            currentPrice *= (1 + momentum);

            // Ensure price stays positive and somewhat reasonable
            currentPrice = Math.max(currentPrice, initialPrice * 0.5);
            currentPrice = Math.min(currentPrice, initialPrice * 2);

            history.push(currentPrice);
        }

        return history;
    }

}
let tickerManager;
// Initialize everything when the page loads
window.addEventListener('load', () => {
    const tweetsContainer = document.getElementById('tweets-container');
    tweetsContainer.style.height = `${window.innerHeight - 48 - 10}px`;
    tweetsContainer.addEventListener('scroll', handleScroll);
    tickerManager = new MemeTickerManager();
    initializeSystem();

});

// Clean up worker on page unload
window.addEventListener('beforeunload', () => {
    if (modelWorker) {
        modelWorker.terminate();
    }
});
