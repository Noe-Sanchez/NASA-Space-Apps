install.packages("lattice")
library(lattice)
xyplot(hp ~ mpg | cyl, data = mtcars, 
       main = "Fuel Efficiency vs Horsepower by Cylinder Count", 
       xlab = "Miles per Gallon", ylab = "Horsepower")  