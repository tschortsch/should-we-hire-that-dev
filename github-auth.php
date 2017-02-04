<?php
if( empty( getenv('GH_CLIENT_ID') ) ) {
    die('GH_CLIENT_ID environment variable is not set!');
}
if( empty( getenv('GH_CLIENT_SECRET') ) ) {
    die('GH_CLIENT_SECRET environment variable is not set!');
}

$code = '';
$access_token = '';
if(!isset($_GET['code'])) {
    // request code
    header('Location: https://github.com/login/oauth/authorize?client_id=' . getenv('GH_CLIENT_ID'));
    exit;
} else {
    // exchange code to access_token
    $code = $_GET['code'];
    $post_data = array(
        'client_id' => getenv('GH_CLIENT_ID'),
        'client_secret' => getenv('GH_CLIENT_SECRET'),
        'code' => $code,
    );

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, 'https://github.com/login/oauth/access_token');
    curl_setopt($ch, CURLOPT_HTTPHEADER, array(
        'Accept: application/json'
    ));
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $post_data);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

    $data = curl_exec($ch);
    curl_close($ch);

    $data_array = json_decode( $data, true );
    $access_token = $data_array['access_token'];
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Should we hire that dev? - GitHub Authorization</title>
</head>
<body>

<script>
    <?php
    if(!empty($access_token)) {
        echo "let accessToken = '" . $access_token . "';";
    }
    ?>
    if(accessToken && accessToken !== '') {
        // save access_token to localStorage
        window.localStorage.setItem('swhtd-gh-access-token', accessToken);
        window.location.href = './';
    }
</script>

<script>
    (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
            (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
        m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
    })(window,document,'script','https://www.google-analytics.com/analytics.js','ga');

    ga('create', 'UA-91391176-1', 'auto');
    ga('send', 'pageview');

</script>
</body>
</html>
