<?php
/**
 *
 * @author Vrataski
 * @date 2023-04-26
 */

// Start a PHP session
session_start();

// Include the connection.php file, which contains the database connection information
include_once('connection.php');

// Check if the GET request contains the id parameter
if(isset($_GET['id'])){

    // Create a SQL DELETE statement to delete the employee record with the specified id
    $sql = "DELETE FROM employee WHERE sol_sn = ?";

    // Prepare the SQL statement
    if($stmt = $conn->prepare($sql)){
        // Bind the id parameter to the SQL statement
        $stmt->bind_param("i", $_GET['id']);
        
        // Execute the SQL statement
        if($stmt->execute()){
            // Set a session variable to indicate that the deletion was successful
            $_SESSION['success'] = '職員資料成功刪除';
        } else {
            // Set a session variable to indicate that the deletion failed
            $_SESSION['error'] = '刪除失敗';
        }
    } else {
        // Set a session variable to indicate that the deletion failed
        $_SESSION['error'] = '刪除失敗';
    }
} else {
    // Set a session variable to indicate that the user must select an employee before deleting a record
    $_SESSION['error'] = '先選擇員工後才刪除資料';
}

// Redirect the user to the index.php page
header('location: index.php');
?>
