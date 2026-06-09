---
title: "Comparing fine-tuning strategies for machine learning force fields in lithium-ion diffusion"
author: Nada Alghamdi, <strong>Paolo De Angelis</strong>, Pietro Asinari, Eliodoro Chiavazzo
journal: "Journal of Physics: Energy"
volume: 8
number: 2
pages: 025013
year: 2026
month: 6
day: 8
keywords: [LiF, Lithium-ion Batteries, Solid Electrolyte Interphase, Knock-off Diffusion, Machine Learning based Interatomic Potential]
image: https://content.cld.iop.org/journals/2515-7655/8/2/025013/revision2/jpenergyae6c5af2_hr.jpg
doi: https://doi.org/10.1088/2515-7655/ae6c5a
mathjax: true
abstract: >-
  Machine learning force fields (MLFFs) are transforming materials science and
  engineering by enabling the study of complex phenomena, such as those critical
  to battery operation. In this work, we explore the predictive capabilities of
  pre-trained and fine-tuned MACE MLFF and compare different fine-tuning
  strategies to predict interstitial lithium diffusivity in LiF, a key component
  in the solid electrolyte interphase in Li-ion batteries. Our results
  demonstrate that the MACE-MPA-0 foundational model achieves comparable
  accuracy to the well-trained deep potential molecular dynamics (DeePMD) in
  predicting key diffusion properties based on molecular dynamics simulations,
  while requiring minimal or no training data. For instance, MACE-MPA-0 predicts
  an activation energy $E_a = 0.22\,\mathrm{eV}$, and the fine-tuned model with
  only 300 data points predicts $E_a = 0.20\,\mathrm{eV}$, both of which show
  good agreement with the DeePMD model reference value of
  $E_a = 0.24\,\mathrm{eV}$. In this work, we provide a solid test case where
  fine-tuning approaches, whether using data generated for DeePMD or data
  produced by the foundational MACE model itself, yield similar robust
  performance to the DeePMD potential trained with over 40,000 actively learned
  data, albeit requiring only a fraction of the training data.
---
