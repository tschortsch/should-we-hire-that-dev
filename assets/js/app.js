const accessToken = window.localStorage.getItem('swhtd-gh-access-token');

const githubAuth = document.querySelector('#github-auth');
const githubLogout = document.querySelector('#github-logout');
const inspectForm = document.querySelector('#inspectform');
const userInformation = document.querySelector('#user-information');

if(!accessToken) {
    console.log('please login first!');
} else {
    githubAuth.style.display = 'none';
    githubLogout.style.display = 'block';
    inspectForm.style.display = 'block';
}

const loadingContainer = document.querySelector('#loading-container');
const usernameInput = document.querySelector('#username');
const commits = document.querySelector('#commits');
const userNotFound = document.querySelector('#user-not-found');
const followers = document.querySelector('#followers');
const userSince = document.querySelector('#user-since');
const userSinceFromNow = document.querySelector('#user-since-from-now');
const repos = document.querySelector('#repos');
const stars = document.querySelector('#stars');
const avatar = document.querySelector('#avatar');
const name = document.querySelector('#name');
const languagesContainer = document.querySelector('#languages');

const commitApiHeaders = new Headers();
commitApiHeaders.append('Accept', 'application/vnd.github.cloak-preview');
inspectForm.addEventListener('submit', inspectFormSubmitHandler);
githubAuth.addEventListener('click', githubAuthSubmitHandler);
githubLogout.addEventListener('submit', githubLogoutSubmitHandler);

const statisticsContainers = [commits, followers, userSince, userSinceFromNow, repos, stars];

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
    window.location.href = 'https://github.com/login/oauth/authorize?client_id=3a54502458a4cd3feabe';
    e.preventDefault();
}
function githubLogoutSubmitHandler(e) {
    window.localStorage.removeItem('swhtd-gh-access-token');
}

function inspectFormSubmitHandler(e) {
    e.preventDefault();
    loadingContainer.classList.add('loading');
    statisticsContainers.forEach((container) => {
        container.innerText = '-';
    });
    avatar.innerHTML = '';
    languagesContainer.innerHTML = '';
    name.innerHTML = '-';

    const username = usernameInput.value;
    let userCheckPromise = checkIfUserExists(username);

    userCheckPromise.then((responseRaw) => {
        if(!responseRaw.ok) {
            userInformation.style.display = 'none';
            userNotFound.style.display = 'inline-block';
            return;
        } else {
            userInformation.style.display = 'inline-block';
            userNotFound.style.display = 'none';
        }
        responseRaw.json().then((userResponse) => {
            console.log(userResponse);
            fillValue(name, userResponse.name);
            fillValue(followers, userResponse.followers);
            const createdAt = new Date(userResponse.created_at);
            const createdAtMoment = moment(createdAt);
            const createdAtTimestamp = createdAtMoment.unix();
            const currentTimestamp = moment().unix();
            fillValue(userSince, createdAtMoment.format('(DD.MM.YYYY)'));
            fillValue(userSinceFromNow, createdAtMoment.fromNow(), currentTimestamp - createdAtTimestamp);
            fillValue(repos, userResponse.public_repos);

            let avatarImg = document.createElement('img');
            avatarImg.src = userResponse.avatar_url;
            avatar.append(avatarImg);

            let fetchCommitsPromise = fetchCommits(username);
            fetchCommitsPromise.then(commitsResponseRaw => {
                commitsResponseRaw.json().then((commitsResponse) => {
                    fillValue(commits, commitsResponse.total_count);
                });
            });
            let fetchReposPromise = fetchRepos(username);
            fetchReposPromise.then(reposResponseRaw => {
                reposResponseRaw.json().then(repos => {
                    let starsCount = 0;
                    repos.forEach(repo => {
                        starsCount += repo.stargazers_count;
                    });
                    fillValue(stars, starsCount);

                    let repoRequestPromises = repos.filter((repo) => {
                        return !repo.fork; // filter out forks
                    }).map((repo) => { // Do request for each repo
                        return new Promise((resolve) => {
                            fetchRepo(repo.languages_url, resolve);
                        });
                    });
                    Promise.all(repoRequestPromises).then((repoResponses) => {
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

                        const languagesSorted = new Map([...languageStatistics.entries()].sort((a, b) => {
                            if(a[1] < b[1]) {
                                return 1;
                            }
                            if(a[1] > b[1]) {
                                return -1;
                            }
                            return 0;
                        }));

                        languagesSorted.forEach((count, language) => {
                            let languageElementProgress = document.createElement("DIV");
                            const languagePercentage = getPercentage(count, totalLanguages);
                            languageElementProgress.innerHTML =
                                '<div class="language-statistics">' +
                                '<div>' + language + '</div>' +
                                '<div class="progress">' +
                                '<div class="progress-bar progress-bar-striped" role="progressbar" style="width: 0%" aria-valuenow="' + languagePercentage + '" aria-valuemin="0" aria-valuemax="100">' +  language + ' (' + languagePercentage + '%)</div>' +
                                '</div>' +
                                '</div>';

                            languagesContainer.appendChild(languageElementProgress);
                            const progressBar = languageElementProgress.children[0].children[1].children[0]; // it's like a kindergarten :/
                            setTimeout(() => {
                                progressBar.style.width = languagePercentage + '%';
                            }, 1000);
                        });
                    });
                });
            });

            Promise.all([fetchCommitsPromise, fetchReposPromise]).then(values => {
                loadingContainer.classList.remove('loading');
            });
        });
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
    const commitQueryUrl = 'https://api.github.com/search/commits?q=author:' + username + '&sort=author-date&order=desc&access_token=' + accessToken;
    return fetch(commitQueryUrl, {
        headers: commitApiHeaders
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
