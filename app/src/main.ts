import "./style.css";

const result = 5 + 3;

const resultElement = document.getElementById("result");
if (resultElement) {
  resultElement.textContent = `Result: 5 + 3 = ${result}`;
}

console.log("Clava app initialized");
