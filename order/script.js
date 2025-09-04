// When the user clicks on the button,
 // toggle between hiding and showing the dropdown content

 function showPopup(i,j) {
	//alert(j);
	 if(i=='b'){
     event.preventDefault();
     document.getElementById("popup_content").classList.toggle("show");
     return false;
 	}else if(i=='a'){
	 event.preventDefault();
     document.getElementById("popup_content2").classList.toggle("show");
     return false;		 
			 }
 }
function hidePopup() {
     event.preventDefault();
     document.getElementById("popup_content").classList.remove('show');
     return false;
 }
function hidePopup2() {
     event.preventDefault();
     document.getElementById("popup_content2").classList.remove('show');
     return false;
 }
 // Close the dropdown if the user clicks outside of it

 window.onclick = function(event) {
     if (!event.target.matches('.thePopup')) {

         let dropdowns = document.getElementsByClassName("popup_content");
         let i;
         for (i = 0; i < dropdowns.length; i++) {
             let openDropdown = dropdowns[i];
             //if (openDropdown.classList.contains('show')) {
           //      openDropdown.classList.remove('show');
            // }
         }
     }

 }
 