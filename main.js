import { TickerGenerator } from './ticker-generator.js';
let modelWorker;
let isGenerating = false;
let usernames;
let resetting = false;
const generator = new TickerGenerator();
let settings = {
    darkMode: false,
    notifications: false,
    notificationsExpected: 0
};

// Load settings from localStorage
try {
    const savedSettings = localStorage.getItem('settings');
    if (savedSettings) {
        settings = {...settings, ...JSON.parse(savedSettings) };
    }
} catch (e) {
    console.error('Error loading settings:', e);
}
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
        case 'loading':
            const progress = data.progress;
            if (Number.isFinite(progress)) {
                document.getElementById('loading').innerText = `Loading your turtle feed... 🐢 (${progress.toFixed(2)}%)`;
            }
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
        // More subtle pastel background colors
        tweetDiv.style.backgroundColor = `hsl(${Math.random() * 360}, 40%, 97%)`;
        tweetDiv.style.borderLeft = `4px solid hsl(${Math.random() * 360}, 70%, 65%)`;

        const rawUsername = usernames[Math.floor(Math.random() * usernames.length)];
        // Create display name by replacing underscores with spaces and capitalizing words
        const displayName = rawUsername
            .split(/[_\d]/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ')
            .trim();

        // Create handle by removing special chars and sometimes capitalizing first letter
        const handle = rawUsername;
        const finalHandle = handle;

        const usernameSpan = document.createElement('span');
        usernameSpan.className = 'username';
        // Add random verified badge to some users
        const isVerified = Math.random() < 0.3;
        usernameSpan.innerHTML = `<strong>${displayName}</strong> ${isVerified ? '✓' : ''}<em>@${finalHandle}</em>`;
        usernameSpan.style.color = `rgb(128, 128, 128)`;

        // Add random emojis to tweet text
        const emojis = ['🚀', '💎', '🌙', '🔥', '💫', '✨', '🎯', '🎮', '🌈', '🎨', '🎪', '🎭', '🎪'];
        const numEmojis = Math.floor(Math.random() * 3);
        let tweetText = processedTweet;
        for (let i = 0; i < numEmojis; i++) {
            const emoji = emojis[Math.floor(Math.random() * emojis.length)];
            tweetText = emoji + ' ' + tweetText;
        }

        // Add random hashtags
        if (Math.random() < 0.3) {
            const tweetHashtags = ['#tothemoon', '#bullish', '#memecoin', '#crypto', '#wagmi', '#nfa', '#dyor'];
            const numHashtags = Math.floor(Math.random() * 2);
            for (let i = 0; i < numHashtags; i++) {
                const hashtag = tweetHashtags[Math.floor(Math.random() * tweetHashtags.length)];
                tweetText += ' ' + hashtag;
            }
        }


        const textDiv = document.createElement('div');
        textDiv.className = 'text';
        textDiv.textContent = tweetText;

        // Add interaction metrics using log-normal distribution
        const interactionsDiv = document.createElement('div');
        interactionsDiv.className = 'tweet-interactions';
        const baseLog = Math.random() * 7; // log base for engagement (e^7 ≈ 1096)
        const likes = Math.floor(Math.exp(baseLog));
        const reposts = Math.floor(likes * (0.1 + Math.random() * 0.2)); // 10-30% of likes
        const comments = Math.floor(reposts * (0.2 + Math.random() * 0.3)); // 20-50% of reposts
        interactionsDiv.innerHTML = `
            <span>🗣 ${comments}</span>
            <span>🔄 ${reposts}</span>
            <span>❤️ ${likes}</span>
        `;

        tweetDiv.append(usernameSpan, textDiv, interactionsDiv);
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
        this.historicalTickers = new Map(); // Store delisted/replaced tickers
        this.watchlist = new Set(); // Store watched tickers
        this.portfolio = {
            cash: 100,
            holdings: new Map(),
            history: [{
                timestamp: Date.now(),
                value: 100
            }],
            hourlyPrices: new Array(24).fill(100) // Track last 24 hours of prices
        };

        // Initialize model parameters
        // Note that ticker prices are internally stored in *cents* for precision reasons - as otherwise floating point errors can accumulate. when transacting, CONVERT
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
        // Try to load saved state, if it fails, initialize fresh
        if (!this.loadState()) {
            this.initializeTickers();
        }
        this.startUpdates();
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
        // Calculate buy amounts based on portfolio value
        const portfolioValue = this.portfolio.cash +
            Array.from(this.portfolio.holdings.entries())
            .reduce((sum, [sym, amount]) => {
                const ticker = this.tickers.get(sym);
                return sum + (ticker ? (ticker.price / 100) * amount : 0);
            }, 0);

        const logBase = Math.round(Math.log10(portfolioValue));
        const smallBuy = Math.pow(10, logBase - 2);
        const largeBuy = Math.pow(10, logBase - 1);
        controls.innerHTML = `
            <div class="buy-controls">
                <button class="buy-btn" data-amount="${smallBuy}">Buy $${smallBuy}</button>
                <button class="buy-btn" data-amount="${largeBuy}">Buy $${largeBuy}</button>
                <button class="buy-btn" data-amount="100" data-direct="true">Buy 100 coins</button>
            </div>
            <div class="sell-controls">
                <button class="sell-btn" data-amount="all">Sell All</button>
            </div>
        `;

        // Add event listeners for trading
        controls.querySelectorAll('.buy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const amount = btn.dataset.amount;
                // Check if amount is a dollar value (not coin amount)
                if (!isNaN(amount) && btn.dataset.direct === undefined) {
                    // For dollar amounts, calculate coins based on current price (convert price to dollars)
                    const priceInDollars = this.tickers.get(symbol).price / 100;
                    const coins = Math.floor(Number(amount) / priceInDollars);
                    this.executeTrade(symbol, coins, true);
                } else {
                    // For direct coin amounts
                    this.executeTrade(symbol, Number(amount), true);
                }
            });
        });
        controls.updateLargeAndSmallBuy = () => {
            const portfolioValue = this.portfolio.cash +
                Array.from(this.portfolio.holdings.entries())
                .reduce((sum, [sym, amount]) => {
                    const ticker = this.tickers.get(sym);
                    return sum + (ticker ? (ticker.price / 100) * amount : 0);
                }, 0);

            const logBase = Math.round(Math.log10(portfolioValue));
            const smallBuy = Math.pow(10, logBase - 2);
            const largeBuy = Math.pow(10, logBase - 1);
            const tickerPrice = this.tickers.get(symbol).price / 100;
            const amountCanBuy = Math.floor(portfolioValue / tickerPrice);
            const amountCanBuyLog10 = Math.max(10 ** Math.ceil(Math.log10(amountCanBuy) - 2), 1);
            controls.querySelectorAll('.buy-btn').forEach((btn, i) => {
                if (i < 2) {
                    btn.textContent = `Buy $${i === 0 ? smallBuy : largeBuy}`;
                    btn.dataset.amount = i === 0 ? smallBuy : largeBuy;
                } else {
                    btn.textContent = `Buy ${amountCanBuyLog10} coins`;
                    btn.dataset.amount = amountCanBuyLog10;
                }
            });
        }
        ticker.controls = controls;

        controls.querySelector('.sell-btn').addEventListener('click', () => {
            const currentHolding = this.portfolio.holdings.get(symbol) || 0;
            this.executeTrade(symbol, currentHolding, false);
        });

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
        // Store the old ticker in historical data before removing
        const oldTicker = this.tickers.get(symbol);
        if (oldTicker) {
            this.historicalTickers.set(symbol, {
                finalPrice: oldTicker.price,
                history: oldTicker.history,
                delistedAt: Date.now(),
                state: oldTicker.state
            });
            if (oldTicker.element) {
                oldTicker.element.remove();
            }
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

        // Save state after replacement
        this.saveState();
    }

    executeTrade(symbol, amount, isBuy) {
        const ticker = this.tickers.get(symbol);
        if (!ticker) return;

        // Convert price from cents to dollars for the transaction
        const priceInDollars = ticker.price / 100;
        const totalCost = priceInDollars * amount;

        if (isBuy) {
            if (totalCost > this.portfolio.cash) {
                const notification = document.querySelector('.balance-notification');
                notification.textContent = 'Insufficient funds!';
                notification.style.display = 'block';

                // Reset the animation
                notification.style.animation = 'none';
                notification.offsetHeight; // Trigger reflow
                notification.style.animation = 'fadeOut 3s forwards';

                // Hide after animation
                setTimeout(() => {
                    notification.style.display = 'none';
                }, 3000);

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

        // Save state after trade
        this.saveState();
    }

    updatePortfolioDisplay() {
        // Update cash balance
        document.querySelector('.balance-amount').textContent = `$${this.portfolio.cash.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

        // Calculate total portfolio value
        let totalValue = this.portfolio.cash;

        // Update hourly prices array
        this.portfolio.hourlyPrices.push(totalValue);
        this.portfolio.hourlyPrices.shift(); // Remove oldest price

        // Calculate 24h change using average of last 24 timesteps
        const prevDayAvg = this.portfolio.hourlyPrices.reduce((a, b) => a + b, 0) / 24;

        // Update holdings
        const holdingsContainer = document.querySelector('.holdings');
        holdingsContainer.innerHTML = '<h3>Your Memecoins</h3>';

        for (const [symbol, amount] of this.portfolio.holdings) {
            const ticker = this.tickers.get(symbol);
            if (!ticker) continue;

            // Calculate current and previous values
            const currentValue = (ticker.price / 100) * amount;
            const prevValue = (ticker.prevPrice / 100) * amount;

            totalValue += currentValue;

            // Add holding value to hourly tracking
            const holdingValue = currentValue;
            this.portfolio.hourlyPrices[23] += holdingValue; // Add to current hour

            const percentChange = ((ticker.price - ticker.prevPrice) / ticker.prevPrice) * 100;
            const changeClass = percentChange >= 0 ? 'positive' : 'negative';

            const holdingDiv = document.createElement('div');
            holdingDiv.className = 'holding-item';
            holdingDiv.innerHTML = `
                <span class="coin-name">$${symbol}</span>
                <span class="coin-amount">${amount.toFixed(0)} ($${currentValue.toFixed(2)})</span>
                <span class="coin-value ${Math.abs(percentChange) < 1e-3 ? '' : changeClass}">${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(1)}%</span>
            `;
            holdingsContainer.appendChild(holdingDiv);
        }

        // Update portfolio stats
        const totalValueElem = document.getElementById('total-value');
        const dailyChangeElem = document.getElementById('daily-change');
        const holdingsCountElem = document.getElementById('holdings-count');

        const portfolioChange = ((totalValue - prevDayAvg) / prevDayAvg) * 100;
        const changeClass = portfolioChange >= 0 ? 'positive' : 'negative';

        totalValueElem.textContent = `$${totalValue.toFixed(2)}`;
        totalValueElem.className = `stat-value ${Math.abs(portfolioChange) < 1e-3 ? '' : changeClass}`;

        dailyChangeElem.textContent = `${portfolioChange >= 0 ? '+' : ''}${portfolioChange.toFixed(2)}%`;
        dailyChangeElem.className = `stat-value ${Math.abs(portfolioChange) < 1e-3 ? '' : changeClass}`;

        holdingsCountElem.textContent = `${this.portfolio.holdings.size} coins`;
    }

    saveState() {
        if (resetting) return;
        const state = {
            tickers: Array.from(this.tickers.entries()).map(([symbol, data]) => [
                symbol,
                {
                    price: data.price,
                    prevPrice: data.prevPrice,
                    history: data.history,
                    state: data.state,
                    momentum: data.momentum
                }
            ]),
            historicalTickers: Array.from(this.historicalTickers.entries()),
            watchlist: Array.from(this.watchlist),
            portfolio: {
                cash: this.portfolio.cash,
                holdings: Array.from(this.portfolio.holdings.entries()),
                history: this.portfolio.history,
                hourlyPrices: this.portfolio.hourlyPrices
            },
            deathSpiralCounter: Array.from(this.REPLACEMENT_THRESHOLDS.deathSpiralCounter.entries())
        };

        try {
            localStorage.setItem('memeTickerState', JSON.stringify(state));
        } catch (e) {
            console.error('Error saving ticker state:', e);
        }
    }

    loadState() {
        try {
            const savedState = localStorage.getItem('memeTickerState');
            if (!savedState) return false;

            const state = JSON.parse(savedState);

            // Restore tickers
            this.tickers = new Map(state.tickers.map(([symbol, data]) => [
                symbol,
                {
                    ...data,
                    element: this.createTickerElement(symbol, data.price, data.history)
                }
            ]));

            // Restore historical tickers
            this.historicalTickers = new Map(state.historicalTickers);

            // Restore watchlist
            this.watchlist = new Set(state.watchlist);

            // Restore portfolio
            this.portfolio = {
                ...state.portfolio,
                holdings: new Map(state.portfolio.holdings)
            };

            // Restore death spiral counter
            this.REPLACEMENT_THRESHOLDS.deathSpiralCounter = new Map(state.deathSpiralCounter);

            return true;
        } catch (e) {
            console.error('Error loading ticker state:', e);
            return false;
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

        priceElement.textContent = `$${(ticker.price / 100).toFixed(6)}`;
        changeElement.textContent = `${percentChange >= 0 ? '▲' : '▼'} ${Math.abs(percentChange).toFixed(2)}%`;

        const changeClass = percentChange >= 0 ? 'price-up' : 'price-down';
        priceElement.className = `ticker-price ${changeClass}`;
        changeElement.className = `ticker-change ${changeClass}`;

        // Update chart
        const canvas = ticker.element.querySelector('canvas');
        this.drawChart(canvas, ticker.history, percentChange >= 0);

        // Save state after updates
        this.saveState();
    }
    update() {
        for (const [symbol, ticker] of this.tickers) {
            ticker.element.controls.updateLargeAndSmallBuy();
            this.updateTicker(symbol);
        }
        // Go over the portfolio and remove any holdings w/ zero coins
        for (const [symbol, amount] of this.portfolio.holdings) {
            if (amount === 0) {
                this.portfolio.holdings.delete(symbol);
            }
        }
        // Update explore page if it's visible
        const exploreSection = document.getElementById('explore-section');
        if (exploreSection && exploreSection.style.display === 'block') {
            updateExploreResults(
                document.getElementById('coin-search').value.toLowerCase(),
                getCurrentFilter()
            );
        }
    }

    startUpdates() {
        this.update();
        setInterval(() => {
            this.update();
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
window.addEventListener('load', async() => {
    // Hide the main container initially
    document.querySelector('.container').style.visibility = 'hidden';

    const tweetsContainer = document.getElementById('tweets-container');
    tweetsContainer.style.height = `${window.innerHeight - 48 - 10}px`;
    tweetsContainer.addEventListener('scroll', handleScroll);

    // Initialize everything
    tickerManager = new MemeTickerManager();
    await initializeSystem();
    initializeExploreTab();
    initializeSettings();

    // Apply initial dark mode state
    applyDarkMode(settings.darkMode);

    // Start notification system if enabled
    if (settings.notifications) {
        startNotificationSystem();
    }

    // Setup navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;

            // Update active state
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Hide all sections
            document.querySelectorAll('.content-section').forEach(section => {
                section.style.display = 'none';
            });

            // Show selected section
            const selectedSection = document.getElementById(`${section}-section`);
            if (selectedSection) {
                selectedSection.style.display = 'block';

                // Update header text
                document.querySelector('.header').textContent =
                    section.charAt(0).toUpperCase() + section.slice(1);
            }
        });
    });

    // Set Trade as active by default
    document.querySelector('[data-section="trade"]').classList.add('active');
    // Show the container and hide loading screen with a fade effect
    document.querySelector('.container').style.visibility = 'visible';
    const loadingScreen = document.getElementById('loading-screen');
    loadingScreen.style.opacity = '1';
    loadingScreen.style.transition = 'opacity 0.5s ease-out';
    loadingScreen.style.opacity = '0';
    setTimeout(() => {
        loadingScreen.style.display = 'none';
    }, 500);
});

function initializeSettings() {
    const darkModeToggle = document.getElementById('dark-mode');
    const notificationsToggle = document.getElementById('notifications');
    const resetButton = document.getElementById('reset-button');

    // Set initial states
    darkModeToggle.checked = settings.darkMode;
    notificationsToggle.checked = settings.notifications;

    // Add event listeners
    darkModeToggle.addEventListener('change', (e) => {
        settings.darkMode = e.target.checked;
        saveSettings();
        applyDarkMode(e.target.checked);
    });

    notificationsToggle.addEventListener('change', (e) => {
        settings.notifications = e.target.checked;
        saveSettings();
        if (e.target.checked) {
            startNotificationSystem();
        }
    });

    // Add reset button functionality
    resetButton.addEventListener('click', () => {
        // Show confirmation dialog
        const confirmed = confirm(
            "Are you sure you want to reset everything?\n\n" +
            "This will:\n" +
            "- Delete all your holdings\n" +
            "- Reset your portfolio\n" +
            "- Clear your watchlist\n" +
            "- Reset all settings\n\n" +
            "This action cannot be undone!"
        );

        if (confirmed) {
            resetting = true; // Set resetting flag
            // Clear all localStorage data
            localStorage.clear();

            // Show a brief "Resetting..." message
            const loadingScreen = document.getElementById('loading-screen');
            loadingScreen.style.display = 'flex';
            loadingScreen.style.opacity = '1';

            // Add a text message under the turtle
            const message = document.createElement('div');
            message.style.marginTop = '1rem';
            message.textContent = 'Resetting...';
            loadingScreen.appendChild(message);
            window.location.reload();
        }
    });
}

function saveSettings() {
    try {
        localStorage.setItem('settings', JSON.stringify(settings));
    } catch (e) {
        console.error('Error saving settings:', e);
    }
}

function applyDarkMode(isDark) {
    document.documentElement.style.filter = isDark ? 'invert(1) hue-rotate(180deg)' : 'none';
    // Don't invert images, videos, trending section, notifications and loading screen
    document.querySelectorAll('img, video, .trending, .in-app-notification, #loading-screen').forEach(el => {
        el.style.filter = 'invert(1) hue-rotate(180deg)';
    });
}

let notificationInterval;

function startNotificationSystem() {
    if (notificationInterval) {
        clearInterval(notificationInterval);
    }

    // Generate a notification every 30-60 seconds
    notificationInterval = setInterval(() => {
        if (!settings.notifications) {
            clearInterval(notificationInterval);
            return;
        }

        // Request permission if needed
        if (Notification.permission !== "granted") {
            Notification.requestPermission();
            return;
        }

        settings.notificationsExpected++;

        // Generate a single tweet optimized for notifications
        modelWorker.postMessage({
            type: 'generate',
            data: {
                count: 1,
                isNotification: true
            }
        });
    }, 15000 + Math.random() * 15000);
}

// Modify handleGeneratedTweets to show notifications
const originalHandleGeneratedTweets = handleGeneratedTweets;
handleGeneratedTweets = function(data) {
    originalHandleGeneratedTweets(data);

    // If this was a notification generation and notifications are enabled
    if (settings.notifications && data.texts.length === 1 && settings.notificationsExpected > 0) {
        settings.notificationsExpected--;
        const tweet = data.texts[0];

        // Try web notification first
        if (Notification.permission === "granted") {
            new Notification("New Memecoin Activity! 🚀", {
                body: tweet,
                icon: "/favicon.ico"
            });
        }

        // Also show in-app notification
        const notification = document.createElement('div');
        notification.className = 'in-app-notification';
        notification.textContent = tweet;
        document.body.appendChild(notification);

        // Remove after animation
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 500);
        }, 5000);
    }
};

function initializeExploreTab() {
    const searchInput = document.getElementById('coin-search');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const resultsContainer = document.getElementById('explore-results');

    // Add search functionality
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        updateExploreResults(searchTerm, getCurrentFilter());
    });

    // Add filter functionality
    filterButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateExploreResults(searchInput.value.toLowerCase(), btn.dataset.filter);
        });
    });

    // Initial results
    updateExploreResults('', 'all');
}

function getCurrentFilter() {
    return document.querySelector('.filter-btn.active').dataset.filter;
}

function updateExploreResults(searchTerm, filter) {
    const resultsContainer = document.getElementById('explore-results');
    resultsContainer.innerHTML = '';

    // Combine active and historical tickers
    const allTickers = new Map([
        ...Array.from(tickerManager.tickers.entries()).map(([symbol, data]) => [
            symbol,
            {...data, status: 'active' }
        ]),
        ...Array.from(tickerManager.historicalTickers.entries()).map(([symbol, data]) => [
            symbol,
            {...data, status: 'delisted' }
        ])
    ]);

    // Filter based on search term and filter type
    const filteredTickers = Array.from(allTickers.entries()).filter(([symbol, data]) => {
        const matchesSearch = symbol.toLowerCase().includes(searchTerm);
        const matchesFilter = filter === 'all' ||
            (filter === 'active' && data.status === 'active') ||
            (filter === 'delisted' && data.status === 'delisted') ||
            (filter === 'watchlist' && tickerManager.watchlist.has(symbol));
        return matchesSearch && matchesFilter;
    });

    // Create and append result cards
    filteredTickers.forEach(([symbol, data]) => {
        const card = createExploreCard(symbol, data);
        resultsContainer.appendChild(card);
    });
}

function createExploreCard(symbol, data) {
    const card = document.createElement('div');
    card.className = 'explore-card';

    const isActive = data.status === 'active';
    const price = isActive ? data.price : data.finalPrice;
    const history = isActive ? data.history : data.history;

    // Calculate statistics
    const allTimeHigh = Math.max(...history);
    const allTimeLow = Math.min(...history);
    const priceChange = isActive ?
        ((price - data.prevPrice) / data.prevPrice * 100) :
        ((data.finalPrice - history[history.length - 2]) / history[history.length - 2] * 100);

    card.innerHTML = `
        <div class="explore-card-header">
            <h3>${symbol}</h3>
            <button class="watch-btn ${tickerManager.watchlist.has(symbol) ? 'watching' : ''}"
                onclick="toggleWatchlist('${symbol}')">
                ${tickerManager.watchlist.has(symbol) ? '👀' : '👁️'}
            </button>
        </div>
        <div class="explore-card-price">
            $${(price / 100).toFixed(6)}
            <span class="price-change ${priceChange >= 0 ? 'positive' : 'negative'}">
                ${priceChange >= 0 ? '▲' : '▼'} ${Math.abs(priceChange).toFixed(2)}%
            </span>
        </div>
        <div class="explore-card-stats">
            <div>ATH: $${(allTimeHigh / 100).toFixed(6)}</div>
            <div>ATL: $${(allTimeLow / 100).toFixed(6)}</div>
            ${isActive ? '' : `<div class="delisted-badge">Delisted</div>`}
        </div>
        <canvas class="explore-chart"></canvas>
    `;

    // Draw chart
    const canvas = card.querySelector('.explore-chart');
    tickerManager.drawChart(canvas, history, priceChange >= 0);

    return card;
}
// Add to window for onclick access
window.toggleWatchlist = function(symbol) {
    if (tickerManager.watchlist.has(symbol)) {
        tickerManager.watchlist.delete(symbol);
    } else {
        tickerManager.watchlist.add(symbol);
    }
    // Save state after watchlist change
    tickerManager.saveState();
    
    updateExploreResults(
        document.getElementById('coin-search').value.toLowerCase(),
        getCurrentFilter()
    );
};

// Clean up worker on page unload
window.addEventListener('beforeunload', () => {
    if (modelWorker) {
        modelWorker.terminate();
    }
});