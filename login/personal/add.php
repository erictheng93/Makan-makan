<?php
/**
 *
 * @author Vrataski
 * @date 2023-04-26
 */

session_save_path('../session_data');
session_start();

$kedai = $_SESSION['shop_ID'];
$kedai_nama = $_SESSION['shop_name'];

include_once('connection.php');

if(isset($_POST['add'])){

    $firstname = htmlspecialchars($_POST['firstname']);
    $empStatus = htmlspecialchars($_POST['empStatus']);
    $address = htmlspecialchars($_POST['address']);
    $empMP = htmlspecialchars($_POST['empMP']);
    $empID = htmlspecialchars($_POST['empID']);
    $empPass = htmlspecialchars($_POST['empPass']);

    // Use prepared statement to prevent SQL Injection
    $stmt = $conn->prepare("INSERT INTO employee (sol_name, sol_id, sol_pass, sol_status, shop_ID, sol_adrress, sol_hp) VALUES (?, ?, ?, ?, ?, ?, ?)");

    // Bind the parameters to the SQL query
    $stmt->bind_param("sssssss", $firstname, $empID, $empPass, $empStatus, $kedai, $address, $empMP);

    // Execute the prepared statement
    if($stmt->execute()){
        $_SESSION['success'] = '職員資料新增成功';
    } else {
        $_SESSION['error'] = '職員資料新增失敗';
    }

} else {
    $_SESSION['error'] = '請先填滿資料';
}

header('location: index.php');
?>
