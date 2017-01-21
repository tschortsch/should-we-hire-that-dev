const accessToken = window.localStorage.getItem('swhtd-gh-access-token');

const pageTitle = document.querySelector('#page-title');
const githubAuthContainer = document.querySelector('#github-auth-container');
const githubAuthButton = document.querySelector('#github-auth');
const githubLogout = document.querySelector('#github-logout');
const inspectForm = document.querySelector('#inspectform');
const userInformation = document.querySelector('#user-information');

setState('search');

const loadingContainer = document.querySelector('#loading-container');
const usernameInput = document.querySelector('#username');
const commitsValue = document.querySelector('#commits');
const errorValue = document.querySelector('#error');
const followersValue = document.querySelector('#followers');
const userSinceValue = document.querySelector('#user-since');
const userSinceFromNowValue = document.querySelector('#user-since-from-now');
const reposValue = document.querySelector('#repos');
const starsValue = document.querySelector('#stars');
const avatarWrapper = document.querySelector('#avatar-wrapper');
const nameValue = document.querySelector('#name');
const userLocationValue = document.querySelector('#location');
const languagesPieChartContainer = document.querySelector('#languages-pie-chart');
let languagesPieChart = null;

inspectForm.addEventListener('submit', inspectFormSubmitHandler);
githubAuthButton.addEventListener('click', githubAuthSubmitHandler);
githubLogout.addEventListener('submit', removeAccessTokenFromLocalStorage);

const statisticsContainers = [nameValue, userLocationValue, commitsValue, followersValue, userSinceValue, userSinceFromNowValue, reposValue, starsValue];

const judgementLimits = {
    'commits': {
        ok: 1000,
        good: 2000,
        ultra: 8000
    },
    'followers': {
        ok: 10,
        good: 50,
        ultra: 800
    },
    'repos': {
        ok: 10,
        good: 25,
        ultra: 80
    },
    'stars': {
        ok: 10,
        good: 50,
        ultra: 200
    },
    'user-since-from-now': {
        ok: (365 * 24 * 60 * 60), // 1 year
        good: 3 * (365 * 24 * 60 * 60), // 3 years
        ultra: 6 * (365 * 24 * 60 * 60) // 6 years
    }
};

function githubAuthSubmitHandler(e) {
    window.location.href = './github-auth.php';
    e.preventDefault();
}
function removeAccessTokenFromLocalStorage() {
    window.localStorage.removeItem('swhtd-gh-access-token');
}

function inspectFormSubmitHandler(e) {
    e.preventDefault();
    startLoading();
    clearValues();
    setState('userinfo');

    const username = usernameInput.value;
    let userCheckPromise = checkIfUserExists(username);

    userCheckPromise.then((responseRaw) => {
        console.log(responseRaw);
        if(rateLimitExceeded(responseRaw.headers)) {
            setError(getRateLimitReason(responseRaw.headers));
            setState('login');
            stopLoading();
            return;
        }
        if(!responseRaw.ok) {
            if(responseRaw.status === 401) {
                setError('Something is wrong with your access_token. Please login again.');
                removeAccessTokenFromLocalStorage();
                setState('login');
            } else if(responseRaw.status === 404) {
                setError('User not found. Try another username.');
                setState('search');
            } else {
                setError('Something went wrong!');
                setState('search');
            }
            stopLoading();
            return;
        }
        responseRaw.json().then((userResponse) => {
            console.log(userResponse);
            fillValue(nameValue, userResponse.name);
            fillValue(userLocationValue, userResponse.location);
            fillValue(followersValue, userResponse.followers);
            const createdAt = new Date(userResponse.created_at);
            const createdAtMoment = moment(createdAt);
            const createdAtTimestamp = createdAtMoment.unix();
            const currentTimestamp = moment().unix();
            fillValue(userSinceValue, createdAtMoment.format('(DD.MM.YYYY)'));
            fillValue(userSinceFromNowValue, createdAtMoment.fromNow(), currentTimestamp - createdAtTimestamp);
            fillValue(reposValue, userResponse.public_repos);

            let avatarImg = document.createElement('img');
            avatarImg.src = userResponse.avatar_url;
            avatarWrapper.append(avatarImg);

            let commitsStatisticsGatheredPromise = new Promise((resolve) => {
                let fetchCommitsPromises = [];
                for(let page = 0; page < 5; page++) {
                    let fetchCommitsPromise = new Promise((resolve, reject) => {
                        fetchCommits(username, page).then(commitsResponseRaw => {
                            if(rateLimitExceeded(commitsResponseRaw.headers)) {
                                reject(new Error(getRateLimitReason(commitsResponseRaw.headers)));
                            }
                            commitsResponseRaw.json().then(commitsResponse => {
                                resolve(commitsResponse);
                            });
                        });
                    }).catch(reason => {
                        setError(reason);
                        setState('login');
                    });
                    fetchCommitsPromises.push(fetchCommitsPromise);
                }

                Promise.all(fetchCommitsPromises).then(commitsResponses => {
                    // if one promise value is undefined (when it gets rejected) stop gathering statistics value
                    const allPromisesResolved = commitsResponses.reduce((accumulator, currentValue) => {
                        return accumulator && currentValue;
                    });
                    if(!allPromisesResolved) {
                        resolve();
                        return;
                    }

                    fillValue(commitsValue, commitsResponses[0].total_count);

                    let allCommitItems = [];
                    commitsResponses.forEach(commitsResponse => {
                        allCommitItems = allCommitItems.concat(commitsResponse.items);
                    });

                    let languageUrlsUnique = allCommitItems.reduce((accumulator, commit) => {
                        return accumulator.add(commit.repository.languages_url);
                    }, new Set());

                    let repoLanguagesPromises = [...languageUrlsUnique.values()].map((language_url) => { // Do request for each repo
                        return new Promise((resolve, reject) => {
                            fetchRepoLanguages(language_url).then((repoLanguagesResponseRaw) => {
                                if(rateLimitExceeded(repoLanguagesResponseRaw.headers)) {
                                    reject(new Error(getRateLimitReason(repoLanguagesResponseRaw.headers)));
                                }
                                repoLanguagesResponseRaw.json().then((repoLanguages) => {
                                    resolve(repoLanguages);
                                });
                            });
                        }).catch(reason => {
                            setError(reason);
                            setState('login');
                        });
                    });
                    Promise.all(repoLanguagesPromises).then((repoLanguagesResponses) => {
                        // if one promise value is undefined (when it gets rejected) stop gathering statistics value
                        const allPromisesResolved = repoLanguagesResponses.reduce((accumulator, currentValue) => {
                            return accumulator && currentValue;
                        });
                        if(!allPromisesResolved) {
                            resolve();
                            return;
                        }

                        let totalLanguages = 0;
                        const languageStatistics = repoLanguagesResponses.reduce((accumulator, repoLanguages) => {
                            Object.keys(repoLanguages).forEach(language => {
                                let count = accumulator.get(language);
                                if(count) {
                                    count += repoLanguages[language];
                                } else {
                                    count = repoLanguages[language];
                                }
                                accumulator.set(language, count);
                                totalLanguages += repoLanguages[language];
                            });
                            return accumulator;
                        }, new Map());
                        console.log(languageStatistics);

                        const languageStatisticsPercentage = [...languageStatistics.entries()].reduce((accumulator, language) => {
                            const languagePercentage = getPercentage(language[1], totalLanguages);
                            if(languagePercentage < 2) {
                                let otherCount = accumulator.get('Other');
                                otherCount += languagePercentage;
                                accumulator.set('Other', otherCount);
                            } else {
                                accumulator.set(language[0], languagePercentage);
                            }
                            return accumulator;
                        }, new Map([['Other', 0]]));
                        console.log(languageStatisticsPercentage);

                        const languageStatisticsSorted = new Map([...languageStatisticsPercentage.entries()].sort((a, b) => {
                            if(a[1] < b[1]) {
                                return 1;
                            }
                            if(a[1] > b[1]) {
                                return -1;
                            }
                            return 0;
                        }));
                        console.log(languageStatisticsSorted);
                        console.log(totalLanguages);

                        let languageStatisticsPieChartData = {
                            labels: [],
                            datasets: [
                                {
                                    data: [],
                                    backgroundColor: [
                                        "#FF6384",
                                        "#36A2EB",
                                        "#FFCE56",
                                        "#96db89",
                                        "#ff80b3",
                                        "#9992ff",
                                        "#a7e7ff"
                                    ],
                                    hoverBackgroundColor: [
                                        "#FF6384",
                                        "#36A2EB",
                                        "#FFCE56",
                                        "#96db89",
                                        "#ff80b3",
                                        "#9992ff",
                                        "#a7e7ff"
                                    ]
                                }]
                        };
                        languageStatisticsSorted.forEach((languagePercentage, language) => {
                            const languagePercentageRounded = round(languagePercentage);
                            languageStatisticsPieChartData.labels.push(language);
                            languageStatisticsPieChartData.datasets[0].data.push(languagePercentageRounded);
                        });

                        languagesPieChart = new Chart(languagesPieChartContainer,{
                            type: 'pie',
                            data: languageStatisticsPieChartData,
                            options: {
                                tooltips: {
                                    callbacks: {
                                        label: function(tooltipItem, data) {
                                            const value = data.datasets[0].data[tooltipItem.index];
                                            return data.labels[tooltipItem.index] + ': ' + value + '%';
                                        }
                                    }
                                }
                            }
                        });

                        resolve();
                    });
                });
            });

            let reposStatisticsGathered = fetchRepos(username);
            reposStatisticsGathered.then(reposResponseRaw => {
                if(rateLimitExceeded(reposResponseRaw.headers)) {
                    setError(getRateLimitReason(reposResponseRaw.headers));
                    setState('login');
                    stopLoading();
                    return;
                }
                reposResponseRaw.json().then(repos => {
                    let starsCount = 0;
                    repos.forEach(repo => {
                        starsCount += repo.stargazers_count;
                    });
                    fillValue(starsValue, starsCount);
                });
            });

            Promise.all([commitsStatisticsGatheredPromise, reposStatisticsGathered]).then(stopLoading);
        });
    }, (rejectedRaw) => {
        setError(rejectedRaw.statusText);
        stopLoading();
    });
}

function fetchRepoLanguages(repoUrl) {
    if(accessToken) {
        repoUrl += '?access_token=' + accessToken;
    }
    return fetch(repoUrl);
}

function getPercentage(value, total) {
    return value *  100 / total;
}

function fetchCommits(username, page) {
    let commitQueryUrl = 'https://api.github.com/search/commits?q=author:' + username + '&sort=author-date&order=desc&per_page=100&page=' + page;
    if(accessToken) {
        commitQueryUrl += '&access_token=' + accessToken;
    }
    return fetch(commitQueryUrl, {
        headers: {
            'Accept': 'application/vnd.github.cloak-preview'
        }
    });
}
function round(num) {
    return Math.round(num * 10) / 10;
}
function fetchRepos(username) {
    let reposQueryUrl = 'https://api.github.com/users/' + username + '/repos';
    if(accessToken) {
        reposQueryUrl += '?access_token=' + accessToken;
    }
    return fetch(reposQueryUrl);
}

function fillValue(container, value, judgementValue) {
    if(typeof judgementValue === 'undefined') {
        judgementValue = value;
    }
    container.classList.remove('value-ultra', 'value-good', 'value-ok', 'value-bad');
    const judgement = getJudgement(container.id, judgementValue);
    if(judgement) {
        container.classList.add(judgement);
    }
    if(Number.isInteger(value)) {
        let valueAnimation = new CountUp(container, 0, value);
        valueAnimation.start();
    } else {
        container.innerText = value;
    }
}

function getJudgement(type, value) {
    if(judgementLimits.hasOwnProperty(type)) {
        if(value >= judgementLimits[type].ultra) {
            return 'value-ultra';
        } else if(value >= judgementLimits[type].good) {
            return 'value-good';
        } else if(value >= judgementLimits[type].ok) {
            return 'value-ok';
        }
        return 'value-bad';
    }
    return false;
}

function checkIfUserExists(username) {
    let userQuery = 'https://api.github.com/users/' + username;
    if(accessToken) {
        userQuery += '?access_token=' + accessToken;
    }
    return fetch(userQuery);
}

/**
 * Username Placeholder Animation
 */
let currentPlaceholderTimeout = null;

usernameInput.addEventListener('focus', (e) => {
    if(currentPlaceholderTimeout !== null) {
        clearTimeout(currentPlaceholderTimeout);
    }
    usernameInput.placeholder = 'that dev';
});
usernameInput.addEventListener('blur', (e) => {
    if(e.target.value === '') {
        clearCurrentTimeout();
        currentPlaceholderTimeout = setTimeout(usernameAnimation, 5000);
    }
});

function usernameAnimation() {
    new Promise((resolve) => {
        usernameInput.placeholder = '';
        type('tschortsch', resolve);
    }).then(() => {
        clearCurrentTimeout();
        currentPlaceholderTimeout = setTimeout(() => {
            new Promise((resolve) => {
                erase(resolve);
            }).then(() => {
                new Promise((resolve) => {
                    clearCurrentTimeout();
                    currentPlaceholderTimeout = setTimeout(() => {
                        type('GitHub username', resolve);
                    }, 1000);
                }).then(() => {
                    clearCurrentTimeout();
                    currentPlaceholderTimeout = setTimeout(() => {
                        new Promise((resolve) => {
                            erase(resolve);
                        }).then(() => {
                            clearCurrentTimeout();
                            currentPlaceholderTimeout = setTimeout(() => {
                                usernameInput.placeholder = 'that dev';
                            }, 1000);
                        });
                    }, 2000);
                });
            });
        }, 2000);
    });
}

function type(text, resolve) {
    let textLength = text.length;

    if(textLength > 0) {
        const currentPlaceholderText = usernameInput.placeholder;
        const nextCharacter = text.charAt(0);
        const remainingText = text.substr(1, textLength);
        usernameInput.placeholder += nextCharacter;
        clearCurrentTimeout();
        currentPlaceholderTimeout = setTimeout(() => {
            type(remainingText, resolve);
        }, 300);
    } else {
        currentPlaceholderTimeout = null;
        resolve();
    }
}

function erase(resolve) {
    const currentPlaceholderText = usernameInput.placeholder;
    usernameInput.placeholder = currentPlaceholderText.substr(0, currentPlaceholderText.length - 1);
    if(usernameInput.placeholder.length > 0) {
        clearCurrentTimeout();
        currentPlaceholderTimeout = setTimeout(() => {
            erase(resolve);
        }, 150);
    } else {
        currentPlaceholderTimeout = null;
        resolve();
    }
}

function clearCurrentTimeout() {
    if(currentPlaceholderTimeout !== null) {
        clearTimeout(currentPlaceholderTimeout);
    }
    currentPlaceholderTimeout = null;
}

currentPlaceholderTimeout = setTimeout(usernameAnimation, 5000);

function setState(state) {
    if(state === 'login') {
        pageTitle.style.display = 'block';
        inspectForm.style.display = 'none';
        userInformation.style.display = 'none';
    } else if(state === 'search') {
        pageTitle.style.display = 'none';
        inspectForm.style.display = 'block';
        userInformation.style.display = 'none';
    } else if(state === 'userinfo') {
        pageTitle.style.display = 'none';
        inspectForm.style.display = 'block';
        userInformation.style.display = 'block';
    }
    if(accessToken) {
        githubLogout.style.display = 'block';
        githubAuthContainer.style.display = 'none';
        githubAuthButton.style.display = 'none';
    } else {
        githubLogout.style.display = 'none';
        githubAuthContainer.style.display = 'block';
        githubAuthButton.style.display = 'inline-block';
    }
}

function setError(message) {
    errorValue.innerText = message;
}
function clearValues() {
    statisticsContainers.forEach((container) => {
        container.innerText = '-';
    });
    avatarWrapper.innerHTML = '';
    if(languagesPieChart) {
        languagesPieChart.destroy();
    }
    setError('');
}
function startLoading() {
    usernameInput.disabled = true;
    loadingContainer.classList.add('loading');
}
function stopLoading() {
    usernameInput.disabled = false;
    loadingContainer.classList.remove('loading');
}

function rateLimitExceeded(headers) {
    const rateLimit = headers.get('X-RateLimit-Remaining');
    console.log(rateLimit);
    return rateLimit && rateLimit <= 0;
}
function getRateLimitReason(headers) {
    let reason = 'Your rate limit is exceeded. You have to login with GitHub to do another request.';
    const rateLimitReset = headers.get('X-RateLimit-Reset');
    if(rateLimitReset) {
        reason = 'Your rate limit is exceeded. You have to wait till ' + moment.unix(rateLimitReset).format('DD.MM.YYYY HH:mm:ss') + ' to do another request.';
    }
    return reason;
}
