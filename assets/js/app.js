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
const errorValue = document.querySelector('#error');
const commitsContainer = document.querySelector('#commits');
const followersContainer = document.querySelector('#followers');
const userSinceContainer = document.querySelector('#user-since');
const userSinceDateValue = document.querySelector('#user-since-date');
const reposContainer = document.querySelector('#repos');
const starsContainer = document.querySelector('#stars');
const avatarWrapper = document.querySelector('#avatar-wrapper');
const nameValue = document.querySelector('#name');
const userLocationValue = document.querySelector('#location');
const rankingContainer = document.querySelector('#ranking');
const languagesPieChartContainer = document.querySelector('#languages-pie-chart');
let languagesPieChart = null;
let maxRanking = 0;
let overallRanking = 0;

inspectForm.addEventListener('submit', inspectFormSubmitHandler);
githubAuthButton.addEventListener('click', githubAuthSubmitHandler);
githubLogout.addEventListener('submit', removeAccessTokenFromLocalStorage);

const statisticsContainers = [userSinceContainer, followersContainer, commitsContainer, reposContainer, starsContainer, rankingContainer];
const judgementLimits = {
    'commits': new Map([
        [100, 10000],
        [90, 8000],
        [80, 6000],
        [70, 4000],
        [60, 2000],
        [50, 1000],
        [40, 700],
        [30, 500],
        [20, 300],
        [10, 100]
    ]),
    'followers': new Map([
        [100, 1000],
        [90, 600],
        [80, 300],
        [70, 150],
        [60, 90],
        [50, 50],
        [40, 30],
        [30, 20],
        [20, 10],
        [10, 5]
    ]),
    'repos': new Map([
        [100, 100],
        [90, 80],
        [80, 60],
        [70, 45],
        [60, 35],
        [50, 25],
        [40, 20],
        [30, 15],
        [20, 10],
        [10, 5]
    ]),
    'stars': new Map([
        [100, 250],
        [90, 200],
        [80, 150],
        [70, 100],
        [60, 70],
        [50, 50],
        [40, 30],
        [30, 20],
        [20, 10],
        [10, 5]
    ]),
    'user-since': new Map([
        [100, 6 * (365 * 24 * 60 * 60)], // 6 years
        [90, 5 * (365 * 24 * 60 * 60)],
        [80, 4.5 * (365 * 24 * 60 * 60)],
        [70, 4 * (365 * 24 * 60 * 60)],
        [60, 3.5 * (365 * 24 * 60 * 60)],
        [50, 3 * (365 * 24 * 60 * 60)],
        [40, 2.5 * (365 * 24 * 60 * 60)],
        [30, 2 * (365 * 24 * 60 * 60)],
        [20, 1.5 * (365 * 24 * 60 * 60)],
        [10, (365 * 24 * 60 * 60)]
    ])
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
            fillStatisticsContainer(followersContainer, userResponse.followers);
            const createdAt = new Date(userResponse.created_at);
            const createdAtMoment = moment(createdAt);
            const createdAtTimestamp = createdAtMoment.unix();
            const currentTimestamp = moment().unix();
            fillValue(userSinceDateValue, createdAtMoment.format('(DD.MM.YYYY)'));
            fillStatisticsContainer(userSinceContainer, createdAtMoment.fromNow(), currentTimestamp - createdAtTimestamp);
            fillStatisticsContainer(reposContainer, userResponse.public_repos);

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

                    fillStatisticsContainer(commitsContainer, commitsResponses[0].total_count);

                    let allCommitItems = [];
                    commitsResponses.forEach(commitsResponse => {
                        allCommitItems = allCommitItems.concat(commitsResponse.items);
                    });

                    // if user has more then 0 commits ;)
                    if(allCommitItems.length > 0) {
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
                                            '#FF6384',
                                            '#36A2EB',
                                            '#FFCE56',
                                            '#96db89',
                                            '#ff80b3',
                                            '#9992ff',
                                            '#a7e7ff'
                                        ],
                                        hoverBackgroundColor: [
                                            '#FF6384',
                                            '#36A2EB',
                                            '#FFCE56',
                                            '#96db89',
                                            '#ff80b3',
                                            '#9992ff',
                                            '#a7e7ff'
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
                    } else {
                        resolve();
                    }
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
                    fillStatisticsContainer(starsContainer, starsCount);
                });
            });

            Promise.all([commitsStatisticsGatheredPromise, reposStatisticsGathered]).then(() => {
                fillRankingContainer(rankingContainer, overallRanking, maxRanking);
                stopLoading();
            });
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

function fillStatisticsContainer(container, value, rawValue) {
    if(typeof rawValue === 'undefined') {
        rawValue = value;
    }
    const valueContainer = container.querySelector('.value');
    const progressBar = container.querySelector('.progress-bar');

    const judgement = getJudgement(container.id, rawValue);
    maxRanking += 100;
    overallRanking += judgement;
    if(judgement > 0) {
        container.classList.add('rank-' + judgement);
    }
    progressBar.style.width = judgement + '%';
    progressBar.setAttribute('aria-valuenow', judgement);
    fillValue(valueContainer, value);
}
function fillRankingContainer(container, value, maxValue) {
    const rankPercentage = value * 100 / maxValue;
    const rankClass = Math.round(rankPercentage / 10) * 10;
    const valueContainer = container.querySelector('.value');
    const progressBar = container.querySelector('.progress-bar');
    container.classList.add('rank-' + rankClass);
    progressBar.style.width = rankPercentage + '%';
    progressBar.setAttribute('aria-valuenow', rankPercentage);
    fillValue(valueContainer, value + ' / ' + maxValue);
}
function fillValue(container, value) {
    if(Number.isInteger(value)) {
        let valueAnimation = new CountUp(container, 0, value);
        valueAnimation.start();
    } else {
        if(!value || value === '') {
            value = '-';
        }
        container.innerText = value;
    }
}

function clearValues() {
    statisticsContainers.forEach((container) => {
        container.classList.remove(
            'rank-10',
            'rank-20',
            'rank-30',
            'rank-40',
            'rank-50',
            'rank-60',
            'rank-70',
            'rank-80',
            'rank-90',
            'rank-100'
        );

        container.querySelector('.value').innerText = '-';
        const progressBar = container.querySelector('.progress-bar');
        progressBar.style.width = '0%';
        progressBar.setAttribute('aria-valuenow', '0');
    });
    avatarWrapper.innerHTML = '';
    nameValue.innerText = '';
    userLocationValue.innerText = '';
    userSinceDateValue.innerText = '';
    if(languagesPieChart) {
        languagesPieChart.destroy();
        languagesPieChart = null;
    }
    overallRanking = 0;
    maxRanking = 0;
    setError('');
}

function getJudgement(type, value) {
    if(judgementLimits.hasOwnProperty(type)) {
        for(let [rank, limit] of judgementLimits[type]) {
            if(value >= limit) {
                return rank;
            }
        }
    }
    return 0;
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

usernameInput.addEventListener('focus', () => {
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
