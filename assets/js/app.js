const accessToken = window.localStorage.getItem('swhtd-gh-access-token');

const pageTitle = document.querySelector('#page-title');
const githubAuthContainer = document.querySelector('#github-auth-container');
const githubLogout = document.querySelector('#github-logout');
const inspectForm = document.querySelector('#inspectform');
const userInformation = document.querySelector('#user-information');

if(!accessToken) {
    setState('login');
} else {
    setState('search');
}

const loadingContainer = document.querySelector('#loading-container');
const githubAuthButton = document.querySelector('button#github-auth');
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
const languagesContainer = document.querySelector('#languages');

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
        if(!responseRaw.ok) {
            if(responseRaw.status === 401) {
                errorValue.innerText = 'Something is wrong with your access_token. Please login again.';
                removeAccessTokenFromLocalStorage();
                setState('login');
            } else if(responseRaw.status === 404) {
                errorValue.innerText = 'User not found. Try another username.';
                setState('search');
            } else {
                errorValue.innerText = 'Something went wrong!';
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
                let fetchCommitsPromise = fetchCommits(username);
                fetchCommitsPromise.then(commitsResponseRaw => {
                    commitsResponseRaw.json().then((commitsResponse) => {
                        fillValue(commitsValue, commitsResponse.total_count);

                        let languageUrlsUnique = commitsResponse.items.reduce((accumulator, commit) => {
                            return accumulator.add(commit.repository.languages_url);
                        }, new Set());
                        let repoLanguagesPromises = [...languageUrlsUnique.values()].map((language_url) => { // Do request for each repo
                            return new Promise((resolve) => {
                                fetchRepo(language_url, resolve);
                            });
                        });
                        Promise.all(repoLanguagesPromises).then((repoResponses) => {
                            let totalLanguages = 0;
                            const languageStatistics = repoResponses.reduce((accumulator, repo) => {
                                Object.keys(repo).forEach(language => {
                                    let count = accumulator.get(language);
                                    if(count) {
                                        count += repo[language];
                                    } else {
                                        count = repo[language];
                                    }
                                    accumulator.set(language, count);
                                    totalLanguages += repo[language];
                                });
                                return accumulator;
                            }, new Map());

                            const languageStatisticsSorted = new Map([...languageStatistics.entries()].sort((a, b) => {
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

                            languageStatisticsSorted.forEach((count, language) => {
                                let languageElementProgress = document.createElement("DIV");
                                const languagePercentage = getPercentage(count, totalLanguages);
                                languageElementProgress.innerHTML =
                                    '<div class="language-statistics">' +
                                    '<div>' + language + '</div>' +
                                    '<div class="progress">' +
                                    '<div class="progress-bar progress-bar-striped" role="progressbar" style="width: 0%" aria-valuenow="' + languagePercentage + '" aria-valuemin="0" aria-valuemax="100">' + languagePercentage + '%</div>' +
                                    '</div>' +
                                    '</div>';

                                languagesContainer.appendChild(languageElementProgress);
                                const progressBar = languageElementProgress.children[0].children[1].children[0]; // it's like a kindergarten :/
                                setTimeout(() => {
                                    progressBar.style.width = languagePercentage + '%';
                                }, 1000);
                            });

                            resolve();
                        });
                    });
                });
            });

            let reposStatisticsGathered = fetchRepos(username);
            reposStatisticsGathered.then(reposResponseRaw => {
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
        errorValue.innerText = rejectedRaw.statusText;
        stopLoading();
    });
}

function fetchRepo(repoUrl, resolve) {
    fetch(repoUrl + '?access_token=' + accessToken).then((repoResponseRaw) => {
        repoResponseRaw.json().then((repo) => {
            resolve(repo);
        });
    });
}

function getPercentage(value, total) {
    return Math.round(value *  100 / total);
}

function fetchCommits(username) {
    const commitQueryUrl = 'https://api.github.com/search/commits?q=author:' + username + '&sort=author-date&order=desc&per_page=100&access_token=' + accessToken;
    return fetch(commitQueryUrl, {
        headers: {
            'Accept': 'application/vnd.github.cloak-preview'
        }
    });
}
function fetchRepos(username) {
    const reposQueryUrl = 'https://api.github.com/users/' + username + '/repos?access_token=' + accessToken;
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
    const userQuery = 'https://api.github.com/users/' + username + '?access_token=' + accessToken;
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
        githubAuthContainer.style.display = 'inline-block';
        inspectForm.style.display = 'none';
        githubLogout.style.display = 'none';
        userInformation.style.display = 'none';
    } else if(state === 'search') {
        pageTitle.style.display = 'none';
        githubAuthContainer.style.display = 'none';
        inspectForm.style.display = 'block';
        githubLogout.style.display = 'block';
        userInformation.style.display = 'none';
    } else if(state === 'userinfo') {
        pageTitle.style.display = 'none';
        githubAuthContainer.style.display = 'none';
        inspectForm.style.display = 'block';
        githubLogout.style.display = 'block';
        userInformation.style.display = 'block';
    }
}

function clearValues() {
    statisticsContainers.forEach((container) => {
        container.innerText = '-';
    });
    avatarWrapper.innerHTML = '';
    languagesContainer.innerHTML = '';
    errorValue.innerText = '';
}
function startLoading() {
    usernameInput.disabled = true;
    loadingContainer.classList.add('loading');
}
function stopLoading() {
    usernameInput.disabled = false;
    loadingContainer.classList.remove('loading');
}
