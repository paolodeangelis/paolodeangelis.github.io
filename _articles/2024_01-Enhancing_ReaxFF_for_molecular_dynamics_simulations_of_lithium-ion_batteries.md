---
title: "Enhancing ReaxFF for molecular dynamics simulations of lithium-ion batteries: an interactive reparameterization protocol"
author: <strong>Paolo De Angelis</strong>, Roberta Cappabianca, Matteo Fasano, Pietro Asinari, Eliodoro Chiavazzo
journal: Scientific Reports
volume: 14
number: 1
pages: 978
year: 2024
month: 1
day: 10
keywords: [Reactive Froce Field,ReaxFF,Diffusion,Interface,Lithium-ion,Battery,Molecular Dymanics,Force Field Parametrization]
image: ../img/2024-img_article_Enhancing_ReaxFF.png
doi: https://doi.org/10.1038/s41598-023-50978-5
abstract: Lithium-ion batteries (LIBs) have become an essential technology for the green economy transition, as they are widely used in portable electronics, electric vehicles, and renewable energy systems. The solid-electrolyte interphase (SEI) is a key component for the correct operation, performance, and safety of LIBs. The SEI arises from the initial thermal metastability of the anode-electrolyte interface, and the resulting electrolyte reduction products stabilize the interface by forming an electrochemical buffer window. This article aims to make a first—but important—step towards enhancing the parametrization of a widely-used reactive force field (ReaxFF) for accurate molecular dynamics (MD) simulations of SEI components in LIBs. To this end, we focus on Lithium Fluoride (LiF), an inorganic salt of great interest due to its beneficial properties in the passivation layer. The protocol relies heavily on various Python libraries designed to work with atomistic simulations allowing robust automation of all the reparameterization steps. The proposed set of configurations, and the resulting dataset, allow the new ReaxFF to recover the solid nature of the inorganic salt and improve the mass transport properties prediction from MD simulation. The optimized ReaxFF surpasses the previously available force field by accurately adjusting the diffusivity of lithium in the solid lattice, resulting in a two-order-of-magnitude improvement in its prediction at room temperature. However, our comprehensive investigation of the simulation shows the strong sensitivity of the ReaxFF to the training set, making its ability to interpolate the potential energy surface challenging. Consequently, the current formulation of ReaxFF can be effectively employed to model specific and well-defined phenomena by utilizing the proposed interactive reparameterization protocol to construct the dataset. Overall, this work represents a significant initial step towards refining ReaxFF for precise reactive MD simulations, shedding light on the challenges and limitations of ReaxFF force field parametrization. The demonstrated limitations emphasize the potential for developing more versatile and advanced force fields to upscale ab initio simulation through our interactive reparameterization protocol, enabling more accurate and comprehensive MD simulations in the future.
---
