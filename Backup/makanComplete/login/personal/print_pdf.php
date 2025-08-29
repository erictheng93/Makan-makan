<?php
/* 人員管理系統
這個文件是製作PDF
會搭配tcpdf文件夾做搭配使用
done by tyk 20221115 
*/
ini_set('default_charset', 'utf-8');
		session_save_path('../session_data');
		session_start();
		
		
	function generateRow(){ //每次執行的時候，都會發出一個新行
		$kedai=$_SESSION['shop_ID']; //捉取shop_ID的Session
		$contents = ''; //contents為空值
		$emp_status=array("admin","店主","廚師","送菜員","收銀員"); //給予emp_status一個一維陣列
		include_once('connection.php'); //需求一次connection.php
		mysqli_set_charset($conn,'utf8');
		$sql = "SELECT * FROM employee WHERE shop_ID='$kedai'";

		//use for MySQLi OOP
		$query = $conn->query($sql);
		while($row = $query->fetch_assoc()){
			$contents .= "
			<tr>
				<td>".$row['sol_sn']."</td>
				<td>".$row['sol_name']."</td>
				<td>".$emp_status[$row['sol_status']]."</td>
				<td>".$row['sol_hp']."</td>
			</tr>
			";
		}
		////////////////

		//use for MySQLi Procedural
		// $query = mysqli_query($conn, $sql);
		// while($row = mysqli_fetch_assoc($query)){
		// 	$contents .= "
		// 	<tr>
		// 		<td>".$row['sol_sn']."</td>
		// 		<td>".$row['firstname']."</td>
		// 		<td>".$row['lastname']."</td>
		// 		<td>".$row['address']."</td>
		// 	</tr>
		// 	";
		// }
		////////////////
		
		return $contents;
	}
	$kedai_nama=$_SESSION['shop_name']; //捉shop_name的Session
	require_once('tcpdf/tcpdf.php'); //捉取tcpdf.php一次
    $pdf = new TCPDF('P', PDF_UNIT, PDF_PAGE_FORMAT, true, 'UTF-8', false); 
	
    $pdf->SetCreator(PDF_CREATOR);  
    $pdf->SetTitle($kedai_nama."員工資料");  
    $pdf->SetHeaderData('', '', PDF_HEADER_TITLE, PDF_HEADER_STRING);  
    $pdf->setHeaderFont(Array(PDF_FONT_NAME_MAIN, '', PDF_FONT_SIZE_MAIN));  
    $pdf->setFooterFont(Array(PDF_FONT_NAME_DATA, '', PDF_FONT_SIZE_DATA));  
    $pdf->SetDefaultMonospacedFont('helvetica');  
    $pdf->SetFooterMargin(PDF_MARGIN_FOOTER);  
    $pdf->SetMargins(PDF_MARGIN_LEFT, '10', PDF_MARGIN_RIGHT);  
    $pdf->setPrintHeader(false);  
    $pdf->setPrintFooter(false);  
    $pdf->SetAutoPageBreak(TRUE, 10);  
    $pdf->SetFont('msungstdlight', '', 12); 
    $pdf->AddPage();  
    $content = '';  
    $content .= '
		<meta http-equiv="Content-type" content="text/html; charset=utf-8" /> 
      	'.$kedai_nama.'<h2 align="center">員工資料</h2>
      	<h4>Members Table</h4>
      	<table border="1" cellspacing="0" cellpadding="3">  
           <tr>  
                <th width="5%">ID</th>
				<th width="20%">使用者名稱</th>
				<th width="20%">使用者職稱</th>
				<th width="55%">使用者手機</th> 
           </tr>  
      ';  
    $content .= generateRow();  
    $content .= '</table>';  
    $pdf->writeHTML($content);  
    $pdf->Output('members.pdf', 'I');
	

?>