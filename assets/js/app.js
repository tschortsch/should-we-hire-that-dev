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
const repos = document.querySelector('#repos');
const stars = document.querySelector('#stars');
const avatar = document.querySelector('#avatar');
const name = document.querySelector('#name');

const commitApiHeaders = new Headers();
commitApiHeaders.append('Accept', 'application/vnd.github.cloak-preview');
inspectForm.addEventListener('submit', inspectFormSubmitHandler);
githubAuth.addEventListener('click', githubAuthSubmitHandler);
githubLogout.addEventListener('submit', githubLogoutSubmitHandler);

const statisticsContainers = [commits, followers, userSince, repos, stars];

const judgementLimits = {
    commits: {
        ok: 1000,
        good: 2000,
        ultra: 8000
    },
    followers: {
        ok: 10,
        good: 50,
        ultra: 800
    },
    repos: {
        ok: 10,
        good: 25,
        ultra: 80
    },
    stars: {
        ok: 10,
        good: 50,
        ultra: 200
    }
};

function githubAuthSubmitHandler(e) {
    const redirectUri = encodeURI('http://localhost/~tschortsch/github-user-inspector/github-auth.html');
    window.location.href = 'https://github.com/login/oauth/authorize?client_id=3a54502458a4cd3feabe&redirect_uri=' + redirectUri;
    e.preventDefault();
}
function githubLogoutSubmitHandler(e) {
    window.localStorage.removeItem('swhtd-gh-access-token');
}

function inspectFormSubmitHandler(e) {
    e.preventDefault();
    loadingContainer.classList.add('loading');
    statisticsContainers.forEach((container) => {
        container.innerText = '';
    });
    avatar.innerHTML = '';
    const username = usernameInput.value;

    let userCheckPromise = checkIfUserExists(username);

    userCheckPromise.then((responseRaw) => {
        if(!responseRaw.ok) {
            userInformation.style.display = 'none';
            userNotFound.style.display = 'block';
            return;
        } else {
            userInformation.style.display = 'block';
            userNotFound.style.display = 'none';
        }
        responseRaw.json().then((userResponse) => {
            console.log(userResponse);
            fillValue(name, userResponse.name);
            fillValue(followers, userResponse.followers);
            const createdAt = new Date(userResponse.created_at);
            fillValue(userSince, createdAt.toLocaleString());
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
                reposResponseRaw.json().then(reposResponse => {
                    let starsCount = 0;
                    reposResponse.forEach(repo => {
                        starsCount += repo.stargazers_count;
                    });
                    fillValue(stars, starsCount);
                });
            });

            Promise.all([fetchCommitsPromise, fetchReposPromise]).then(values => {
                loadingContainer.classList.remove('loading');
            });
        });
    });
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

function fillValue(container, value) {
    container.classList.remove('value-ultra', 'value-good', 'value-ok', 'value-bad');
    const judgement = getJudgement(container.id, value);
    if(judgement) {
        container.classList.add(judgement);
    }
    container.innerText = value;
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
