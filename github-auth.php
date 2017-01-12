<?php
if( empty( getenv('GH_CLIENT_SECRET') ) ) {
    die('GH_CLIENT_SECRET environment variable is not set!');
}

$code = '';
$access_token = '';
if(isset($_GET['code'])) {
    $code = $_GET['code'];
    $post_data = array(
        'client_id' => '3a54502458a4cd3feabe',
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
    <title>Title</title>
</head>
<body>

<script>
    <?php
    if(!empty($access_token)) {
        echo "let accessToken = '" . $access_token . "';";
    }
    ?>
    if(accessToken && accessToken !== '') {
        window.localStorage.setItem('swhtd-gh-access-token', accessToken);
        window.location.href = 'http://localhost/~tschortsch/github-user-inspector/';
    }
</script>
</body>
</html>
